import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const isTurkish = GLib.get_language_names().some(lang => lang.startsWith('tr'));

export default class NotiPanelExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._closeTimerId = null;
        this._bannerTimerId = null;
        this._marqueeTimerId = null;
        this._sourcesMap = new Map();
        // New flag to track banner visibility independent of timer id
        this._bannerActive = false;
        this._prayerTimesEnabledId = null;
        this._prayerCityId = null;
        this._prayerCountryId = null;
        this._prayerMethodId = null;
        this._prayerCountdownPositionId = null;
        this._prayerTimerId = null;
        this._cachedTimings = null;
        this._cachedTimingsDate = '';
        this._lastTriggeredPrayer = '';
        this._prayerPanelLabel = new St.Label({
            style_class: 'notipanel-prayer-panel-label',
            y_align: Clutter.ActorAlign.CENTER,
        });
        if (this._prayerPanelLabel.clutter_text) {
            this._prayerPanelLabel.clutter_text.use_markup = true;
            this._prayerPanelLabel.clutter_text.single_line_mode = false;
            this._prayerPanelLabel.clutter_text.line_wrap = false;
        }

        // Get the native GNOME date/clock menu
        let dateMenu = Main.panel.statusArea.dateMenu;
        if (!dateMenu) return;

        // Hide native GNOME Shell notification dot/indicator
        if (dateMenu._indicator) {
            dateMenu._indicator.hide();
            this._originalIndicatorStyle = dateMenu._indicator.style;
            dateMenu._indicator.style = 'width: 0px; height: 0px; opacity: 0; margin: 0px; padding: 0px;';
        }

        // ── Block native GNOME Shell popup banners ──
        if (Main.messageTray) {
            this._originalShowNotification = Main.messageTray._showNotification.bind(Main.messageTray);
            Main.messageTray._showNotification = () => {
                // Suppress native popup banner
                return;
            };
        }

        // ── Override clock text formatting ──
        if (dateMenu._clockDisplay) {
            this._originalClockBox = dateMenu._clockDisplay.get_parent();

            // Save the original set_text method
            this._originalSetText = dateMenu._clockDisplay.set_text.bind(dateMenu._clockDisplay);

            // Save original show method
            this._originalClockShow = dateMenu._clockDisplay.show.bind(dateMenu._clockDisplay);
            dateMenu._clockDisplay.show = () => {
                // Do not show native clock display
            };
            dateMenu._clockDisplay.hide();

            // Create custom clock layout
            this._customClockBox = new St.BoxLayout({
                orientation: Clutter.Orientation.HORIZONTAL,
                y_align: Clutter.ActorAlign.CENTER,
                style: 'spacing: 8px;'
            });
            this._customDateLabel = new St.Label({
                style: 'text-align: center;',
                y_align: Clutter.ActorAlign.CENTER,
            });
            this._customTimeLabel = new St.Label({
                style: 'text-align: left;',
                y_align: Clutter.ActorAlign.CENTER,
            });

            if (this._customDateLabel.clutter_text) {
                this._customDateLabel.clutter_text.use_markup = true;
                this._customDateLabel.clutter_text.single_line_mode = false;
                this._customDateLabel.clutter_text.line_wrap = false;
            }
            if (this._customTimeLabel.clutter_text) {
                this._customTimeLabel.clutter_text.use_markup = true;
                this._customTimeLabel.clutter_text.single_line_mode = false;
                this._customTimeLabel.clutter_text.line_wrap = false;
            }

            this._customClockBox.add_child(this._customDateLabel);
            this._customClockBox.add_child(this._customTimeLabel);

            // Connect to notify::text to format the clock whenever it changes
            this._clockNotifyId = dateMenu._clockDisplay.connect('notify::text', () => {
                this._updateClockDisplay();
            });

            // Force initial formatting
            this._updateClockDisplay();
        }

        if (dateMenu) {
            this._indicatorContainer = new St.Widget({
                layout_manager: new Clutter.BinLayout(),
                y_align: Clutter.ActorAlign.CENTER,
                x_align: Clutter.ActorAlign.CENTER,
            });

            this._customIcon = new St.Icon({
                style_class: 'notipanel-custom-icon',
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
            });
            this._customBadge = new St.Label({
                style_class: 'notipanel-badge',
                x_align: Clutter.ActorAlign.START,
                y_align: Clutter.ActorAlign.START,
            });
            // Shift the badge slightly to the top-left corner of the bell icon
            this._customBadge.translation_x = -5;
            this._customBadge.translation_y = -5;

            this._indicatorContainer.add_child(this._customIcon);
            this._indicatorContainer.add_child(this._customBadge);

            this._bannerButton = new St.Button({
                reactive: true,
                can_focus: true,
                y_align: Clutter.ActorAlign.CENTER,
                style_class: 'notipanel-banner-button'
            });
            this._bannerBox = new St.BoxLayout({
                orientation: Clutter.Orientation.HORIZONTAL,
                y_align: Clutter.ActorAlign.CENTER,
            });
            this._bannerButton.set_child(this._bannerBox);

            this._bannerButton.connect('clicked', () => {
                if (this._currentNotification) {
                    try {
                        this._currentNotification.activate();
                    } catch (e) {
                        console.error("NotiPanel Error activating notification: " + e);
                    }
                    this._hideTempBanner();
                }
            });

            this._syncPanelLayout();
        }

        // ── Custom filter row integration into native message list ──
        if (dateMenu && dateMenu._messageList) {
            dateMenu._messageList.show();

            this._filterRow = new St.BoxLayout({
                orientation: Clutter.Orientation.HORIZONTAL,
                style_class: 'notipanel-filter-row',
                style: 'padding-bottom: 8px; spacing: 6px;'
            });

            let container = dateMenu._messageList;
            container.insert_child_at_index(this._filterRow, 0);

            this._activeFilter = null;
            this._rebuildFilterRow();
            this._applyFilters();
        }

        this._bannerPosId = this._settings.connect('changed::banner-position-relative-to-clock', () => this._syncPanelLayout());

        // ── Connect hover events to native dateMenu ──
        this._enterId = dateMenu.connect('enter-event', () => {
            if (!this._settings.get_boolean('hover-to-show')) return;
            this._cancelCloseTimer();
            if (!dateMenu.menu.isOpen) dateMenu.menu.open();
        });

        this._leaveId = dateMenu.connect('leave-event', () => {
            if (!this._settings.get_boolean('hover-to-show')) return;
            this._startCloseTimer();
        });

        this._menuLeaveId = dateMenu.menu.actor.connect('leave-event', () => {
            if (!this._settings.get_boolean('hover-to-show')) return;
            this._startCloseTimer();
        });

        this._menuEnterId = dateMenu.menu.actor.connect('enter-event', () => {
            if (!this._settings.get_boolean('hover-to-show')) return;
            this._cancelCloseTimer();
        });

        // ── Decorate messages when menu opens or updates ──
        this._openStateId = dateMenu.menu.connect('open-state-changed', (menu, isOpen) => {
            if (isOpen) {
                this._decorateMessageList();
                this._rebuildFilterRow();
                this._applyFilters();
                this._updatePrayerData();
            }
        });

        this._queueChangedId = Main.messageTray.connect('queue-changed', () => {
            this._updateIndicatorState();
            this._rebuildFilterRow();
            this._applyFilters();
            if (dateMenu.menu.isOpen) {
                this._decorateMessageList();
            }
        });

        this._sourceAddedId = Main.messageTray.connect('source-added', (tray, source) => {
            this._trackSource(source);
            this._updateIndicatorState();
            this._rebuildFilterRow();
            this._applyFilters();
            if (dateMenu.menu.isOpen) {
                this._decorateMessageList();
            }
        });

        this._sourceRemovedId = Main.messageTray.connect('source-removed', (tray, source) => {
            this._untrackSource(source);
            this._updateIndicatorState();
            this._rebuildFilterRow();
            this._applyFilters();
        });

        for (let source of Main.messageTray.getSources()) {
            this._trackSource(source);
        }

        // ── settings listeners ──
        this._clockShowId = this._settings.connect('changed::panel-show-clock', () => this._updateClockDisplay());
        this._dateShowId  = this._settings.connect('changed::panel-show-date',  () => this._updateClockDisplay());
        this._clockModeId = this._settings.connect('changed::clock-format-mode', () => this._updateClockDisplay());
        this._clockCustId = this._settings.connect('changed::clock-custom-format', () => this._updateClockDisplay());
        this._iconTypeId  = this._settings.connect('changed::indicator-icon-type', () => this._updateIndicatorIcon());
        this._iconColorId = this._settings.connect('changed::indicator-color',     () => this._updateIndicatorIcon());
        this._hideEmptyId = this._settings.connect('changed::hide-when-empty',     () => this._syncVisibility(dateMenu));
        this._prayerTimesEnabledId = this._settings.connect('changed::enable-prayer-times', () => this._rebuildPrayerBox());
        this._prayerCityId = this._settings.connect('changed::prayer-city', () => this._updatePrayerData());
        this._prayerCountryId = this._settings.connect('changed::prayer-country', () => this._updatePrayerData());
        this._prayerMethodId = this._settings.connect('changed::prayer-method', () => this._updatePrayerData());
        this._prayerCountdownPositionId = this._settings.connect('changed::prayer-countdown-position', () => this._syncPanelLayout());

        // ── Inject DND & Settings buttons next to the native date header ──
        this._injectCalendarHeaderButtons(dateMenu);

        // Initial setup
        this._updateIndicatorIcon();
        this._updateIndicatorState();
        this._decorateMessageList();
        this._rebuildPrayerBox();
    }

    _updateClockDisplay() {
        let dateMenu = Main.panel.statusArea.dateMenu;
        if (!dateMenu || !dateMenu._clockDisplay) return;

        if (this._updatingClock) return;
        this._updatingClock = true;

        try {
            // Keep native clock hidden so it doesn't overlap/interfere
            dateMenu._clockDisplay.hide();

            let showClock = this._settings.get_boolean('panel-show-clock');
            if (!showClock) {
                if (this._customClockBox) this._customClockBox.hide();
                return;
            }

            let placement = this._settings.get_string('banner-position-relative-to-clock') || 'left';
            if (this._bannerActive && placement === 'replace') {
                if (this._customClockBox) this._customClockBox.hide();
                return;
            }

            let now = GLib.DateTime.new_now_local();

            if (this._customDateLabel && this._customTimeLabel) {
                // Left Column: Date & Day name (e.g. 29 May on line 1, Cuma on line 2)
                let dateStr = isTurkish ? now.format('%d %b') : now.format('%b %d');
                let dayStr = now.format('%A'); // e.g. Cuma

                // Right Column: Time (e.g. 16:55)
                let timeStr = now.format('%H:%M');

                this._customDateLabel.clutter_text.set_markup(
                    `<span size="8000" color="#ffffff">${dateStr}</span>\n<span size="8000" color="#dddddd" weight="bold">${dayStr}</span>`
                );
                this._customTimeLabel.clutter_text.set_markup(
                    `<span size="16000" weight="bold" color="#ffffff">${timeStr}</span>`
                );
                if (this._customClockBox) this._customClockBox.show();
            }
        } finally {
            this._updatingClock = false;
        }
    }

    _syncPanelLayout() {
        let dateMenu = Main.panel.statusArea.dateMenu;
        if (!dateMenu) return;

        // Find the panel box that contains dateMenu (center, left, or right)
        let panelBox = null;
        for (let box of [Main.panel._centerBox, Main.panel._rightBox, Main.panel._leftBox]) {
            if (box && box.contains && box.contains(dateMenu)) {
                panelBox = box;
                break;
            }
        }

        // Use the original clockBox saved at enable() time.
        // We CANNOT call get_parent() here because after the first layout pass
        // _clockDisplay lives inside _clockWrapper (not the real clock container),
        // which would make clockBox === _clockWrapper and cause it to be added to itself.
        let clockBox = this._originalClockBox;
        if (!clockBox) return;



        // ── Build clockWrapper if not yet created ──
        if (!this._clockWrapper) {
            this._clockWrapper = new St.BoxLayout({
                orientation: Clutter.Orientation.HORIZONTAL,
                y_align: Clutter.ActorAlign.CENTER,
                x_align: Clutter.ActorAlign.CENTER,
                style: 'spacing: 4px;'
            });
        }

        // ── Apply center alignment for two-line mode ──
        if (dateMenu._clockDisplay) {
            let mode = this._settings.get_string('clock-format-mode') || 'standard';
            let isTwoLine = (mode === 'two-lines' || mode === 'two-lines-12h' || mode === 'two-lines-date-day-time');
            if (isTwoLine) {
                dateMenu._clockDisplay.style = 'text-align: center;';
            } else {
                dateMenu._clockDisplay.style = '';
            }
        }

        // ── Remove all our widgets from wherever they currently live ──
        const safeRemove = (widget) => {
            if (widget && widget.get_parent()) {
                widget.get_parent().remove_child(widget);
            }
        };
        safeRemove(this._indicatorContainer);
        safeRemove(this._bannerLabel);
        safeRemove(this._bannerTextWrapper);
        safeRemove(dateMenu._clockDisplay);
        safeRemove(this._customClockBox);
        safeRemove(this._prayerPanelLabel);
        if (this._clockWrapper.get_parent()) safeRemove(this._clockWrapper);
        // Remove bannerButton from panel box if it's there
        if (this._bannerButton && this._bannerButton.get_parent()) {
            safeRemove(this._bannerButton);
        }
        if (this._bannerSpacer && this._bannerSpacer.get_parent()) {
            safeRemove(this._bannerSpacer);
        }

        let placement = this._settings.get_string('banner-position-relative-to-clock') || 'left';
        let bannerActive = this._bannerActive;

        if (this._customBadge) {
            if (placement === 'right') {
                this._customBadge.x_align = Clutter.ActorAlign.END;
                this._customBadge.translation_x = 5;
            } else {
                this._customBadge.x_align = Clutter.ActorAlign.START;
                this._customBadge.translation_x = -5;
            }
        }

        // ── Rebuild clockWrapper contents ──
        let showPrayer = this._settings.get_string('prayer-countdown-position') || 'hidden';
        let enablePrayer = this._settings.get_boolean('enable-prayer-times');
        
        let widgets = [];
        
        // Push indicator
        widgets.push(this._indicatorContainer);
        
        // Push clock if not hidden by replace banner
        if (!(placement === 'replace' && bannerActive)) {
            if (placement === 'right') {
                widgets.unshift(this._customClockBox);
            } else {
                widgets.push(this._customClockBox);
            }
        }
        
        // Push prayer label if visible
        if (enablePrayer && showPrayer !== 'hidden') {
            this._prayerPanelLabel.show();
            if (showPrayer === 'left') {
                widgets.unshift(this._prayerPanelLabel);
            } else {
                widgets.push(this._prayerPanelLabel);
            }
        } else {
            this._prayerPanelLabel.hide();
        }
        
        // Add them to wrapper in order
        widgets.forEach(w => {
            if (w) this._clockWrapper.add_child(w);
        });
        clockBox.add_child(this._clockWrapper);

        // ── Place banner button in PANEL BOX as a sibling of dateMenu ──
        if (bannerActive && placement !== 'dropdown-only') {
            if (this._bannerBox) {
                // Rebuild bannerBox contents
                if (this._bannerIcon && !this._bannerBox.contains(this._bannerIcon)) {
                    this._bannerBox.add_child(this._bannerIcon);
                }
                if (this._bannerTextWrapper && !this._bannerBox.contains(this._bannerTextWrapper)) {
                    this._bannerBox.add_child(this._bannerTextWrapper);
                } else if (this._bannerLabel && !this._bannerBox.contains(this._bannerLabel)) {
                    this._bannerBox.add_child(this._bannerLabel);
                }
            }

            if (panelBox) {
                // dateMenu may be in the panel as dateMenu itself or dateMenu.container.
                // Search through all children for any match.
                let children = panelBox.get_children();
                let dateMenuIdx = -1;
                for (let i = 0; i < children.length; i++) {
                    let c = children[i];
                    if (c === dateMenu || c === dateMenu.container ||
                        (dateMenu.actor && c === dateMenu.actor)) {
                        dateMenuIdx = i;
                        break;
                    }
                }

                // Build bannerSpacer if not yet created to balance the layout
                if (!this._bannerSpacer) {
                    this._bannerSpacer = new St.Bin({
                        opacity: 0,
                        visible: false,
                    });
                    let constraint = new Clutter.BindConstraint({
                        source: this._bannerButton,
                        coordinate: Clutter.BindCoordinate.WIDTH,
                    });
                    this._bannerSpacer.add_constraint(constraint);
                }

                if (placement === 'left') {
                    if (dateMenuIdx >= 0) {
                        panelBox.insert_child_at_index(this._bannerButton, dateMenuIdx);
                        panelBox.insert_child_at_index(this._bannerSpacer, dateMenuIdx + 2);
                        this._bannerSpacer.show();
                    } else {
                        panelBox.insert_child_at_index(this._bannerButton, 0);
                        this._bannerSpacer.hide();
                    }
                } else if (placement === 'right') {
                    if (dateMenuIdx >= 0) {
                        panelBox.insert_child_at_index(this._bannerSpacer, dateMenuIdx);
                        panelBox.insert_child_at_index(this._bannerButton, dateMenuIdx + 2);
                        this._bannerSpacer.show();
                    } else {
                        panelBox.insert_child_at_index(this._bannerButton, children.length);
                        this._bannerSpacer.hide();
                    }
                } else {
                    // replace
                    let insertIdx = dateMenuIdx >= 0 ? dateMenuIdx + 1 : children.length;
                    panelBox.insert_child_at_index(this._bannerButton, insertIdx);
                    this._bannerSpacer.hide();
                }
            }
        } else {
            if (this._bannerSpacer) {
                this._bannerSpacer.hide();
            }
        }
    }


    _updateIndicatorIcon() {
        if (!this._customIcon) return;
        let type  = this._settings.get_string('indicator-icon-type') || 'bell';
        let color = this._settings.get_string('indicator-color')     || '#89b4fa';

        if (type === 'dot') {
            this._customIcon.icon_name = 'media-record-symbolic';
            this._customIcon.icon_size = 10;
        } else {
            this._customIcon.icon_name = 'preferences-system-notifications-symbolic';
            this._customIcon.icon_size = 16;
        }

        let count = 0;
        for (let source of Main.messageTray.getSources()) {
            count += source.notifications.length;
        }

        let bannerActive = this._bannerActive;
        let hideWhenEmpty = this._settings.get_boolean('hide-when-empty');

        if (bannerActive) {
            this._customIcon.hide();
            this._customBadge.hide();
            if (this._indicatorContainer) this._indicatorContainer.hide();
            return;
        }

        if (count > 0) {
            if (this._indicatorContainer) this._indicatorContainer.show();
            this._customIcon.show();
            if (type === 'dot') {
                this._customIcon.style = 'color: #ef4444;';
                this._customBadge.hide();
            } else if (type === 'bell-badge') {
                this._customIcon.style = 'color: #ef4444;';
                this._customBadge.set_text(count.toString());
                this._customBadge.show();
            } else {
                this._customIcon.style = 'color: #ef4444;';
                this._customBadge.hide();
            }
        } else {
            if (hideWhenEmpty) {
                if (this._indicatorContainer) this._indicatorContainer.hide();
                this._customIcon.hide();
                this._customBadge.hide();
            } else {
                if (this._indicatorContainer) this._indicatorContainer.show();
                this._customIcon.show();
                this._customIcon.style = `color: ${color}; opacity: 0.4;`;
                this._customBadge.hide();
            }
        }
    }

    _updateIndicatorState() {
        this._updateIndicatorIcon();
    }

    _syncVisibility() {
        this._updateIndicatorIcon();
    }

    _resolveSourceIcon(source, size) {
        if (!source) return null;
        size = size || 16;

        // Try source.icon (GIcon)
        if (source.icon) {
            try { return new St.Icon({ gicon: source.icon, icon_size: size }); } catch (e) {}
        }

        // Try source.gicon (GIcon)
        if (source.gicon) {
            try { return new St.Icon({ gicon: source.gicon, icon_size: size }); } catch (e) {}
        }

        // Try source.app.get_icon()
        if (source.app && typeof source.app.get_icon === 'function') {
            try {
                let gicon = source.app.get_icon();
                if (gicon) return new St.Icon({ gicon: gicon, icon_size: size });
            } catch (e) {}
        }

        // Try source._app.get_icon()
        if (source._app && typeof source._app.get_icon === 'function') {
            try {
                let gicon = source._app.get_icon();
                if (gicon) return new St.Icon({ gicon: gicon, icon_size: size });
            } catch (e) {}
        }

        // Try source.createIcon()
        if (source.createIcon && typeof source.createIcon === 'function') {
            try {
                let ic = source.createIcon(size);
                if (ic) return ic;
            } catch (e) {}
        }

        // Try source.iconName (string icon name)
        if (source.iconName && typeof source.iconName === 'string') {
            try { return new St.Icon({ icon_name: source.iconName, icon_size: size }); } catch (e) {}
        }

        return null;
    }

    _rebuildFilterRow() {
        if (!this._filterRow) return;
        this._filterRow.destroy_all_children();

        let dateMenu = Main.panel.statusArea.dateMenu;
        if (!dateMenu || !dateMenu._messageList || !dateMenu._messageList._sections) {
            this._filterRow.hide();
            return;
        }

        let activeSources = [];
        for (let source of Main.messageTray.getSources()) {
            if (source.notifications && source.notifications.length > 0) {
                activeSources.push(source);
            }
        }

        if (activeSources.length === 0) {
            this._filterRow.hide();
            return;
        }
        this._filterRow.show();

        // "All" filter button
        let allIcon = new St.Icon({
            icon_name: 'view-grid-symbolic',
            icon_size: 16
        });
        let allBtn = new St.Button({
            child: allIcon,
            style_class: 'notipanel-filter-btn' + (!this._activeFilter ? ' active' : ''),
            reactive: true
        });
        allBtn.connect('clicked', () => {
            this._activeFilter = null;
            this._applyFilters();
            this._rebuildFilterRow();
        });
        this._filterRow.add_child(allBtn);

        // Add button for each active app source
        for (let source of activeSources) {
            let appIcon = this._resolveSourceIcon(source, 16);
            if (!appIcon) {
                appIcon = new St.Icon({ icon_name: 'preferences-system-notifications-symbolic', icon_size: 16 });
            }

            let btn = new St.Button({
                child: appIcon,
                style_class: 'notipanel-filter-btn' + (this._activeFilter === source.id ? ' active' : ''),
                reactive: true
            });
            btn.connect('clicked', () => {
                if (this._activeFilter === source.id) {
                    this._activeFilter = null;
                } else {
                    this._activeFilter = source.id;
                }
                this._applyFilters();
                this._rebuildFilterRow();
            });
            this._filterRow.add_child(btn);
        }
    }

    _applyFilters() {
        let dateMenu = Main.panel.statusArea.dateMenu;
        if (!dateMenu || !dateMenu._messageList || !dateMenu._messageList._sections) return;

        for (let [source, section] of dateMenu._messageList._sections.entries()) {
            let actor = section.actor || section;
            if (!actor) continue;

            let sourceId = source && source.id;
            if (this._activeFilter && sourceId !== this._activeFilter) {
                actor.hide();
            } else {
                actor.show();
            }
        }
        // DO NOT call _rebuildFilterRow() here - would cause infinite loop
    }

    _injectCalendarHeaderButtons(dateMenu) {
        let bin = dateMenu.menu.box.get_first_child();
        let calendarArea = bin ? bin.get_first_child() : null;
        let areaChildren = calendarArea ? calendarArea.get_children() : [];
        let vbox = areaChildren.find(c => c !== dateMenu._messageList);

        if (vbox && dateMenu._date) {
            vbox.remove_child(dateMenu._date);

            this._topHeader = new St.BoxLayout({
                orientation: Clutter.Orientation.HORIZONTAL,
                x_expand: true,
                style_class: 'notipanel-top-header-row'
            });
            this._topHeader.add_child(dateMenu._date);

            this._btnBox = new St.BoxLayout({
                orientation: Clutter.Orientation.HORIZONTAL,
                y_align: Clutter.ActorAlign.CENTER,
                x_align: Clutter.ActorAlign.END,
                style_class: 'notipanel-top-buttons-box'
            });

            // DND button
            let dndIcon = new St.Icon({ icon_name: 'preferences-system-notifications-symbolic', icon_size: 14 });
            this._dndBtn = new St.Button({
                child: dndIcon,
                style_class: 'notipanel-menu-dnd-btn',
                y_align: Clutter.ActorAlign.CENTER,
                reactive: true,
                can_focus: true,
            });
            let dndSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.notifications' });
            const updateDndIcon = () => {
                let showBanners = dndSettings.get_boolean('show-banners');
                dndIcon.icon_name = showBanners ? 'preferences-system-notifications-symbolic' : 'notifications-disabled-symbolic';
                if (showBanners) this._dndBtn.remove_style_class_name('active');
                else this._dndBtn.add_style_class_name('active');
            };
            updateDndIcon();
            this._dndBtn.connect('clicked', () => {
                let current = dndSettings.get_boolean('show-banners');
                dndSettings.set_boolean('show-banners', !current);
            });
            this._dndSettingsNotifyId = dndSettings.connect('changed::show-banners', updateDndIcon);
            this._dndSettings = dndSettings;

            // Settings button
            let settingsIcon = new St.Icon({ icon_name: 'preferences-system-symbolic', icon_size: 14 });
            this._settingsBtn = new St.Button({
                child: settingsIcon,
                style_class: 'notipanel-menu-settings-btn',
                y_align: Clutter.ActorAlign.CENTER,
                reactive: true,
                can_focus: true,
            });
            this._settingsBtn.connect('clicked', () => {
                dateMenu.menu.close();
                this.openPreferences();
            });

            this._btnBox.add_child(this._dndBtn);
            this._btnBox.add_child(this._settingsBtn);
            this._topHeader.add_child(this._btnBox);

            vbox.insert_child_at_index(this._topHeader, 0);
        }
    }

    _removeCalendarHeaderButtons(dateMenu) {
        let bin = dateMenu.menu.box.get_first_child();
        let calendarArea = bin ? bin.get_first_child() : null;
        let areaChildren = calendarArea ? calendarArea.get_children() : [];
        let vbox = areaChildren.find(c => c !== dateMenu._messageList);

        if (vbox && this._topHeader && dateMenu._date) {
            vbox.remove_child(this._topHeader);
            this._topHeader.remove_child(dateMenu._date);
            
            vbox.insert_child_at_index(dateMenu._date, 0);

            if (this._dndSettings && this._dndSettingsNotifyId) {
                this._dndSettings.disconnect(this._dndSettingsNotifyId);
            }

            this._topHeader.destroy();
            this._topHeader = null;
            this._btnBox = null;
        }
    }

    _decorateMessageList() {
        let dateMenu = Main.panel.statusArea.dateMenu;
        if (!dateMenu || !dateMenu._messageList) return;

        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            if (!dateMenu || !dateMenu._messageList) return GLib.SOURCE_REMOVE;

            const scan = (actor) => {
                if (!actor) return;

                let isMessage = false;
                try {
                    let styleClass = actor.style_class || '';
                    if (styleClass.includes('message') && !styleClass.includes('message-list')) {
                        isMessage = true;
                    }
                } catch (e) {}

                if (isMessage) {
                    let texts = [];
                    const findText = (a) => {
                        if (a instanceof St.Label && a.text) {
                            texts.push(a.text.toLowerCase());
                        }
                        if (a.get_children) {
                            a.get_children().forEach(findText);
                        }
                    };
                    findText(actor);

                    let fullText = texts.join(' ');
                    let keywords = ['onay', 'izin', 'permission', 'antigravity', 'approve', 'confirm'];
                    let isApproval = keywords.some(kw => fullText.includes(kw));

                    if (isApproval) {
                        actor.add_style_class_name('approval');
                    } else {
                        actor.remove_style_class_name('approval');
                    }

                    // Split message body at colon and shift first part to card title
                    let titleLabel = null;
                    let bodyLabel = null;

                    const findLabels = (a) => {
                        if (a instanceof St.Label) {
                            let sc = a.style_class || '';
                            if (sc.includes('message-title')) {
                                titleLabel = a;
                            } else if (sc.includes('message-body')) {
                                bodyLabel = a;
                            }
                        }
                        if (a.get_children) {
                            a.get_children().forEach(findLabels);
                        }
                    };
                    findLabels(actor);

                    if (titleLabel && bodyLabel) {
                        let mainTitle = titleLabel.text || '';
                        let mainBody = bodyLabel.text || '';

                        if (mainBody && mainBody.includes(':') && !mainBody.includes('://')) {
                            let idx = mainBody.indexOf(':');
                            let subject = mainBody.substring(0, idx).trim();
                            let desc = mainBody.substring(idx + 1).replace(/^[:\s]+/, '').trim();

                            if (subject && desc) {
                                if (mainTitle && !mainTitle.includes(subject)) {
                                    titleLabel.text = mainTitle + ': ' + subject;
                                } else if (!mainTitle) {
                                    titleLabel.text = subject;
                                }
                                bodyLabel.text = desc;
                            }
                        }
                    }
                }

                if (actor.get_children) {
                    actor.get_children().forEach(scan);
                }
            };

            scan(dateMenu._messageList);
            return GLib.SOURCE_REMOVE;
        });
    }

    _getHistoryFile() {
        let dirPath = GLib.build_filenamev([GLib.get_user_config_dir(), 'notipanel']);
        GLib.mkdir_with_parents(dirPath, 0x1c0);
        return GLib.build_filenamev([dirPath, 'history.json']);
    }

    _loadHistory() {
        let filePath = this._getHistoryFile();
        if (!GLib.file_test(filePath, GLib.FileTest.EXISTS)) {
            return [];
        }
        try {
            let [ok, content] = GLib.file_get_contents(filePath);
            if (ok) {
                let decoder = new TextDecoder('utf-8');
                let str = decoder.decode(content);
                return JSON.parse(str) || [];
            }
        } catch (e) {
            console.error("NotiPanel history load error: " + e);
        }
        return [];
    }

    _saveHistory(history) {
        let filePath = this._getHistoryFile();
        try {
            let str = JSON.stringify(history);
            GLib.file_set_contents(filePath, str);
        } catch (e) {
            console.error("NotiPanel history save error: " + e);
        }
    }

    _addToHistory(title, body, appName) {
        let history = this._loadHistory();
        let item = {
            title: title || '',
            body: body || '',
            app: appName || 'System',
            timestamp: new Date().toLocaleTimeString()
        };
        history.unshift(item);
        if (history.length > 50) {
            history = history.slice(0, 50);
        }
        this._saveHistory(history);
    }

    _trackSource(source) {
        if (this._sourcesMap.has(source)) return;
        let id = source.connect('notification-added', (src, notification) => {
            let title = notification.title || notification.summary || '';
            let body  = notification.bannerBodyText || notification.body || '';
            let appName = src.title || 'App';

            // Add to history
            this._addToHistory(title, body, appName);

            // Play sound
            if (this._settings.get_boolean('enable-sound')) {
                let file = this._settings.get_string('sound-file');
                if (!file || !GLib.file_test(file, GLib.FileTest.EXISTS)) {
                    file = '/usr/share/sounds/freedesktop/stereo/message.oga';
                }
                if (GLib.file_test(file, GLib.FileTest.EXISTS)) {
                    try { Gio.Subprocess.new(['paplay', file], Gio.SubprocessFlags.NONE); } catch (e) {}
                }
            }
            
            // Check blacklist before displaying banner
            let blacklist = this._settings.get_string('banner-blacklist') || '';
            let blacklistedApps = blacklist.split(',').map(s => s.trim().toLowerCase()).filter(s => s.length > 0);
            let isBlacklisted = blacklistedApps.includes(appName.toLowerCase());

            if (!isBlacklisted) {
                this._showTempBanner(title, body, src, notification);
            }

            let dateMenu = Main.panel.statusArea.dateMenu;
            if (dateMenu && dateMenu.menu.isOpen) {
                this._decorateMessageList();
            }
        });
        this._sourcesMap.set(source, id);
    }

    _untrackSource(source) {
        let id = this._sourcesMap.get(source);
        if (id) {
            source.disconnect(id);
            this._sourcesMap.delete(source);
        }
    }

    _hideTempBanner() {
        this._stopMarquee();
        if (this._bannerTimerId) {
            GLib.source_remove(this._bannerTimerId);
            this._bannerTimerId = null;
        }
        // Ensure banner active flag cleared in case timer was removed externally
        this._bannerActive = false;
        if (this._bannerTextWrapper) this._bannerTextWrapper.hide();
        if (this._bannerIcon) this._bannerIcon.hide();
        if (this._bannerSpacer) this._bannerSpacer.hide();
        if (this._bannerButton) {
            this._bannerButton.remove_style_class_name('approval');
        }
        this._currentNotification = null;
        this._pendingClockUpdate = false;
        this._syncPanelLayout();
        // Force clock text refresh so two-line markup is re-applied immediately
        this._updateClockDisplay();
        this._updateIndicatorIcon();
    }

    _showTempBanner(title, body, source, notification) {
        if (this._bannerTimerId) {
            GLib.source_remove(this._bannerTimerId);
            this._bannerTimerId = null;
        }
        this._stopMarquee();
        this._currentNotification = notification;

        // Lazy initialize banner widgets if not present
        if (!this._bannerTextWrapper) {
            this._bannerTextWrapper = new St.BoxLayout({
                vertical: true,
                y_align: Clutter.ActorAlign.CENTER,
                x_align: Clutter.ActorAlign.START,
                style: 'spacing: 2px;'
            });
            this._bannerIcon = new St.Bin({
                y_align: Clutter.ActorAlign.CENTER,
                style_class: 'notipanel-banner-icon',
                style: 'margin-right: 6px;'
            });
            this._bannerAppLabel = new St.Label({
                style_class: 'notipanel-banner-app-label',
                style: 'font-weight: bold; font-size: 11px; text-align: left; color: #89b4fa;'
            });
            this._bannerBodyLabel = new St.Label({
                style_class: 'notipanel-banner-body-label',
                style: 'font-size: 11px; text-align: left; color: #cdd6f4;'
            });
            this._bannerTextWrapper.add_child(this._bannerAppLabel);
            this._bannerTextWrapper.add_child(this._bannerBodyLabel);
        }

        // App Icon
        if (this._bannerIcon) {
            this._bannerIcon.opacity = 255;
            this._bannerIcon.set_child(null);
            if (this._settings.get_boolean('show-banner-icon') && source) {
                let appIcon = this._resolveSourceIcon(source, 18);
                if (appIcon) {
                    this._bannerIcon.set_child(appIcon);
                    this._bannerIcon.show();
                } else {
                    this._bannerIcon.hide();
                }
            } else {
                this._bannerIcon.hide();
            }
        }

        let placement = this._settings.get_string('banner-position-relative-to-clock') || 'left';
        if (placement === 'dropdown-only') return;

        // Mark banner as active and sync layout
        this._bannerActive = true;
        this._syncPanelLayout();
        this._updateClockDisplay();

        let appName = (source && source.title) || 'Bildirim';
        let topText = appName;
        let bottomText = '';

        let mainTitle = title || '';
        let mainBody = body || '';

        // If body has a colon, split body into subject and description
        if (mainBody && mainBody.includes(':')) {
            let idx = mainBody.indexOf(':');
            let subject = mainBody.substring(0, idx).trim();
            let desc = mainBody.substring(idx + 1).replace(/^[:\s]+/, '').trim();
            topText = appName + ': ' + subject;
            bottomText = desc;
        }
        // If body does not have a colon but title has a colon, split title
        else if (mainTitle && mainTitle.includes(':')) {
            let idx = mainTitle.indexOf(':');
            let subject = mainTitle.substring(0, idx).trim();
            let desc = mainTitle.substring(idx + 1).replace(/^[:\s]+/, '').trim();
            topText = appName + ': ' + subject;
            bottomText = desc;
        }
        // Normal case (no colons)
        else {
            if (mainTitle && mainTitle.toLowerCase() !== appName.toLowerCase()) {
                topText = appName + ': ' + mainTitle;
            } else {
                topText = appName;
            }
            bottomText = mainBody;
        }

        const maxLimit  = this._settings.get_int('banner-max-width') || 250;
        const bannerHeight = this._settings.get_int('banner-height') || 40;

        // Detect if notification is approval
        let fullText = (topText + ' ' + bottomText).toLowerCase();
        let keywords = ['onay', 'izin', 'permission', 'antigravity', 'approve', 'confirm'];
        let isApproval = keywords.some(kw => fullText.includes(kw));

        if (isApproval) {
            this._bannerButton.add_style_class_name('approval');
            this._bannerAppLabel.style = 'font-weight: bold; font-size: 11px; text-align: left; color: #f9e2af;';
        } else {
            this._bannerButton.remove_style_class_name('approval');
            this._bannerAppLabel.style = 'font-weight: bold; font-size: 11px; text-align: left; color: #89b4fa;';
        }

        if (this._bannerTextWrapper) {
            this._bannerAppLabel.set_text(topText.replace(/\n/g, ' '));
            
            let cleanBody = bottomText.replace(/\n/g, ' ');
            this._bannerBodyLabel.clutter_text.line_wrap = false;
            this._bannerBodyLabel.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            this._bannerBodyLabel.set_text(cleanBody);

            this._bannerTextWrapper.style = `width: ${maxLimit}px; max-width: ${maxLimit}px; min-width: ${maxLimit}px; height: ${bannerHeight}px; max-height: ${bannerHeight}px; min-height: ${bannerHeight}px; text-align: left;`;
            this._bannerTextWrapper.show();

            // Slide-in animation
            this._bannerTextWrapper.translation_x = 50;
            this._bannerTextWrapper.opacity = 0;
            this._bannerTextWrapper.ease({
                translation_x: 0, opacity: 255, duration: 350,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                    if (this._settings.get_boolean('banner-scroll-enabled'))
                        this._startMarquee(cleanBody);
                }
            });
        }

        const timeout = this._settings.get_int('display-timeout') || 5;
        this._bannerTimerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, timeout, () => {
            if (this._bannerTextWrapper) {
                this._bannerTextWrapper.ease({
                    translation_x: -50, opacity: 0, duration: 350,
                    mode: Clutter.AnimationMode.EASE_IN_QUAD,
                    onComplete: () => {
                        this._hideTempBanner();
                    }
                });
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    _startMarquee(fullText) {
        this._stopMarquee();
        const charLimit = 25;
        if (fullText.length <= charLimit) return;
        let marqueeText  = fullText + '     |     ';
        let currentIndex = 0;
        const interval   = this._settings.get_int('banner-scroll-speed') || 200;
        this._marqueeTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, interval, () => {
            if (this._bannerBodyLabel) {
                let display = marqueeText.substring(currentIndex) + marqueeText.substring(0, currentIndex);
                this._bannerBodyLabel.set_text(display.substring(0, charLimit));
                currentIndex = (currentIndex + 1) % marqueeText.length;
            }
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopMarquee() {
        if (this._marqueeTimerId) {
            GLib.source_remove(this._marqueeTimerId);
            this._marqueeTimerId = null;
        }
    }

    _startCloseTimer() {
        this._cancelCloseTimer();
        let delay = this._settings.get_int('hover-close-delay') || 800;
        this._closeTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
            let dateMenu = Main.panel.statusArea.dateMenu;
            if (dateMenu && dateMenu.menu.isOpen) dateMenu.menu.close();
            this._closeTimerId = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    _cancelCloseTimer() {
        if (this._closeTimerId) {
            GLib.source_remove(this._closeTimerId);
            this._closeTimerId = null;
        }
    }

    async _fetchPrayerTimes(city, country, method) {
        try {
            let url = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=${method}`;
            let proc = Gio.Subprocess.new(
                ['curl', '-L', '-s', '-m', '10', url],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_MERGE
            );
            return new Promise((resolve, reject) => {
                proc.communicate_utf8_async(null, null, (obj, res) => {
                    try {
                        let [ok, stdout, stderr] = obj.communicate_utf8_finish(res);
                        if (ok && stdout) {
                            let data = JSON.parse(stdout);
                            if (data && data.data && data.data.timings) {
                                resolve(data.data.timings);
                            } else {
                                reject(new Error("Invalid API response"));
                            }
                        } else {
                            reject(new Error("Curl command failed"));
                        }
                    } catch (e) {
                        reject(e);
                    }
                });
            });
        } catch (e) {
            return Promise.reject(e);
        }
    }

    _rebuildPrayerBox() {
        if (this._prayerBox) {
            this._prayerBox.destroy();
            this._prayerBox = null;
        }

        if (!this._settings.get_boolean('enable-prayer-times')) return;

        let dateMenu = Main.panel.statusArea.dateMenu;
        if (!dateMenu) return;

        let bin = dateMenu.menu.box.get_first_child();
        let calendarArea = bin ? bin.get_first_child() : null;
        if (!calendarArea) return;
        let areaChildren = calendarArea.get_children() || [];
        let vbox = areaChildren.find(c => c !== dateMenu._messageList);
        if (!vbox) return;

        this._prayerBox = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            style_class: 'notipanel-prayer-box'
        });

        let header = new St.BoxLayout({
            orientation: Clutter.Orientation.HORIZONTAL,
            style_class: 'notipanel-prayer-header'
        });
        let title = new St.Label({
            text: isTurkish ? 'Namaz Vakitleri' : 'Prayer Times',
            style_class: 'notipanel-prayer-title',
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        this._prayerCountdownLabel = new St.Label({
            text: '',
            style_class: 'notipanel-prayer-countdown',
            y_align: Clutter.ActorAlign.CENTER
        });
        header.add_child(title);
        header.add_child(this._prayerCountdownLabel);
        this._prayerBox.add_child(header);

        this._prayerGrid = new St.BoxLayout({
            orientation: Clutter.Orientation.HORIZONTAL,
            style_class: 'notipanel-prayer-grid'
        });
        this._prayerBox.add_child(this._prayerGrid);

        vbox.insert_child_at_index(this._prayerBox, 1);

        this._updatePrayerData();
    }

    async _updatePrayerData() {
        if (!this._prayerBox) return;

        let city = this._settings.get_string('prayer-city') || 'Istanbul';
        let country = this._settings.get_string('prayer-country') || 'Turkey';
        let method = this._settings.get_string('prayer-method') || '13';

        let todayStr = new Date().toDateString();

        if (this._cachedTimings && this._cachedTimingsDate === todayStr) {
            this._fillPrayerGrid(this._cachedTimings);
            return;
        }

        try {
            let timings = await this._fetchPrayerTimes(city, country, method);
            this._cachedTimings = timings;
            this._cachedTimingsDate = todayStr;
            this._fillPrayerGrid(timings);
        } catch (e) {
            console.error("NotiPanel Error fetching prayer times: " + e);
            this._prayerCountdownLabel.set_text(isTurkish ? 'Hata!' : 'Error!');
        }
    }

    _fillPrayerGrid(timings) {
        if (!this._prayerGrid) return;
        this._prayerGrid.destroy_all_children();

        const keys = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
        const names = isTurkish ? {
            'Fajr': 'İmsak',
            'Sunrise': 'Güneş',
            'Dhuhr': 'Öğle',
            'Asr': 'İkindi',
            'Maghrib': 'Akşam',
            'Isha': 'Yatsı'
        } : {
            'Fajr': 'Fajr',
            'Sunrise': 'Sunrise',
            'Dhuhr': 'Dhuhr',
            'Asr': 'Asr',
            'Maghrib': 'Maghrib',
            'Isha': 'Isha'
        };

        let now = new Date();
        let currentMinutes = now.getHours() * 60 + now.getMinutes();

        let nextPrayerKey = null;
        let minDiff = 1440;
        let prayerMinutesMap = {};

        keys.forEach(k => {
            let val = timings[k];
            if (val) {
                let parts = val.split(':');
                let h = parseInt(parts[0]);
                let m = parseInt(parts[1]);
                let pMinutes = h * 60 + m;
                prayerMinutesMap[k] = pMinutes;

                let diff = pMinutes - currentMinutes;
                if (diff > 0 && diff < minDiff) {
                    minDiff = diff;
                    nextPrayerKey = k;
                }
            }
        });

        if (!nextPrayerKey) {
            nextPrayerKey = 'Fajr';
        }

        this._nextPrayerKey = nextPrayerKey;
        this._prayerMinutesMap = prayerMinutesMap;

        keys.forEach(k => {
            let val = timings[k];
            if (!val) return;

            let itemBox = new St.BoxLayout({
                orientation: Clutter.Orientation.VERTICAL,
                style_class: 'notipanel-prayer-item' + (k === nextPrayerKey ? ' active' : '')
            });
            itemBox.set_x_expand(true);

            let label = new St.Label({
                text: names[k],
                style_class: 'notipanel-prayer-label'
            });
            if (label.clutter_text) {
                label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
            }
            let value = new St.Label({
                text: val,
                style_class: 'notipanel-prayer-value'
            });
            if (value.clutter_text) {
                value.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
            }

            itemBox.add_child(label);
            itemBox.add_child(value);
            this._prayerGrid.add_child(itemBox);
        });

        this._startPrayerCountdown();
    }

    _startPrayerCountdown() {
        this._stopPrayerCountdown();

        this._prayerTimerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 10, () => {
            this._updatePrayerCountdown();
            return GLib.SOURCE_CONTINUE;
        });

        this._updatePrayerCountdown();
    }

    _stopPrayerCountdown() {
        if (this._prayerTimerId) {
            GLib.source_remove(this._prayerTimerId);
            this._prayerTimerId = null;
        }
    }

    _updatePrayerCountdown() {
        if (!this._prayerCountdownLabel || !this._nextPrayerKey || !this._prayerMinutesMap) return;

        let now = new Date();
        let currentMinutes = now.getHours() * 60 + now.getMinutes();
        let currentSeconds = now.getSeconds();

        let targetMinutes = this._prayerMinutesMap[this._nextPrayerKey];
        if (targetMinutes === undefined) return;

        let diffSeconds = (targetMinutes * 60) - (currentMinutes * 60 + currentSeconds);

        if (diffSeconds < 0) {
            diffSeconds += 24 * 60 * 60;
        }

        let todayKey = new Date().toDateString() + '_' + this._nextPrayerKey;
        if (diffSeconds <= 0 && diffSeconds > -10 && this._lastTriggeredPrayer !== todayKey) {
            this._lastTriggeredPrayer = todayKey;
            this._triggerPrayerAlert();
            this._updatePrayerData();
            return;
        }

        let h = Math.floor(diffSeconds / 3600);
        let m = Math.floor((diffSeconds % 3600) / 60);

        const names = isTurkish ? {
            'Fajr': 'İmsak',
            'Sunrise': 'Güneş',
            'Dhuhr': 'Öğle',
            'Asr': 'İkindi',
            'Maghrib': 'Akşam',
            'Isha': 'Yatsı'
        } : {
            'Fajr': 'Fajr',
            'Sunrise': 'Sunrise',
            'Dhuhr': 'Dhuhr',
            'Asr': 'Asr',
            'Maghrib': 'Maghrib',
            'Isha': 'Isha'
        };

        let nextName = names[this._nextPrayerKey];
        let hoursStr = h > 0 ? `${h}sa ` : '';
        let countdownText = `${nextName} vaktine: ${hoursStr}${m}dk`;
        this._prayerCountdownLabel.set_text(countdownText);

        if (this._prayerPanelLabel) {
            let shortName = names[this._nextPrayerKey];
            if (isTurkish) {
                const suffixes = {
                    'Fajr': 'İmsak\'a',
                    'Sunrise': 'Güneş\'e',
                    'Dhuhr': 'Öğle\'ye',
                    'Asr': 'İkindi\'ye',
                    'Maghrib': 'Akşam\'a',
                    'Isha': 'Yatsı\'ya'
                };
                shortName = suffixes[this._nextPrayerKey] || shortName;
            } else {
                shortName = `to ${shortName}`;
            }
            let timeStr = h > 0 ? `${h}sa${m}dk` : `${m}dk`;
            this._prayerPanelLabel.clutter_text.set_markup(
                `<span size="8500" color="#f9e2af">${shortName}</span>\n<span size="8000" weight="bold" color="#a6e3a1">${timeStr}</span>`
            );
        }
    }

    _triggerPrayerAlert() {
        if (!this._settings.get_boolean('enable-adhan')) return;

        let file = this._settings.get_string('adhan-sound-file');
        if (file && GLib.file_test(file, GLib.FileTest.EXISTS)) {
            try { Gio.Subprocess.new(['paplay', file], Gio.SubprocessFlags.NONE); } catch (e) {}
        }

        const names = isTurkish ? {
            'Fajr': 'İmsak',
            'Sunrise': 'Güneş',
            'Dhuhr': 'Öğle',
            'Asr': 'İkindi',
            'Maghrib': 'Akşam',
            'Isha': 'Yatsı'
        } : {
            'Fajr': 'Fajr',
            'Sunrise': 'Sunrise',
            'Dhuhr': 'Dhuhr',
            'Asr': 'Asr',
            'Maghrib': 'Maghrib',
            'Isha': 'Isha'
        };
        let pName = names[this._nextPrayerKey];
        let title = isTurkish ? `Namaz Vakti: ${pName}` : `Prayer Time: ${pName}`;
        let body = isTurkish ? `${pName} vakti girdi.` : `${pName} time has started.`;

        try {
            Gio.Subprocess.new(['notify-send', '-i', 'alarm-symbolic', title, body], Gio.SubprocessFlags.NONE);
        } catch (e) {}
    }

    disable() {
        this._cancelCloseTimer();
        this._stopMarquee();
        if (this._bannerTimerId) {
            GLib.source_remove(this._bannerTimerId);
            this._bannerTimerId = null;
        }

        // Restore native GNOME Shell popup banner method
        if (this._originalShowNotification && Main.messageTray) {
            Main.messageTray._showNotification = this._originalShowNotification;
            this._originalShowNotification = null;
        }

        let dateMenu = Main.panel.statusArea.dateMenu;
        if (dateMenu) {
            // Restore original set_text and clock visibility
            if (dateMenu._clockDisplay) {
                if (this._clockNotifyId) {
                    dateMenu._clockDisplay.disconnect(this._clockNotifyId);
                    this._clockNotifyId = null;
                }
                if (this._originalClockShow) {
                    dateMenu._clockDisplay.show = this._originalClockShow;
                }
                if (dateMenu._clockDisplay.clutter_text) {
                    dateMenu._clockDisplay.clutter_text.single_line_mode = true;
                    dateMenu._clockDisplay.clutter_text.line_wrap = false;
                    dateMenu._clockDisplay.clutter_text.use_markup = false;
                    dateMenu._clockDisplay.clutter_text.ellipsize = 3; // END
                }
                dateMenu._clockDisplay.x_align = Clutter.ActorAlign.FILL;
                if (this._originalClockShow) {
                    this._originalClockShow();
                } else {
                    dateMenu._clockDisplay.show();
                }
                
                // Use the original clockBox we saved at enable() time
                let clockBox = this._originalClockBox;

                // Remove _clockDisplay from _clockWrapper if needed
                if (this._clockWrapper) {
                    if (dateMenu._clockDisplay.get_parent() === this._clockWrapper) {
                        this._clockWrapper.remove_child(dateMenu._clockDisplay);
                    }
                }
                if (this._customClockBox && this._customClockBox.get_parent()) {
                    this._customClockBox.get_parent().remove_child(this._customClockBox);
                }

                if (clockBox) {
                    if (this._customIcon && this._customIcon.get_parent()) this._customIcon.get_parent().remove_child(this._customIcon);
                    if (this._customBadge && this._customBadge.get_parent()) this._customBadge.get_parent().remove_child(this._customBadge);
                    if (this._indicatorContainer && this._indicatorContainer.get_parent()) this._indicatorContainer.get_parent().remove_child(this._indicatorContainer);
                    if (this._bannerIcon && this._bannerIcon.get_parent()) this._bannerIcon.get_parent().remove_child(this._bannerIcon);
                    if (this._bannerLabel && this._bannerLabel.get_parent()) this._bannerLabel.get_parent().remove_child(this._bannerLabel);
                    if (this._bannerTextWrapper && this._bannerTextWrapper.get_parent()) this._bannerTextWrapper.get_parent().remove_child(this._bannerTextWrapper);
                    if (this._bannerButton && this._bannerButton.get_parent()) this._bannerButton.get_parent().remove_child(this._bannerButton);
                    if (this._bannerSpacer && this._bannerSpacer.get_parent()) this._bannerSpacer.get_parent().remove_child(this._bannerSpacer);
                    if (this._clockWrapper && this._clockWrapper.get_parent()) this._clockWrapper.get_parent().remove_child(this._clockWrapper);

                    // Restore _clockDisplay to its original container
                    if (dateMenu._clockDisplay.get_parent() !== clockBox) {
                        clockBox.add_child(dateMenu._clockDisplay);
                    }
                }
                this._originalClockBox = null;

                if (this._customIcon) {
                    this._customIcon.destroy();
                    this._customIcon = null;
                }
                if (this._customBadge) {
                    this._customBadge.destroy();
                    this._customBadge = null;
                }
                if (this._indicatorContainer) {
                    this._indicatorContainer.destroy();
                    this._indicatorContainer = null;
                }
                if (this._clockWrapper) {
                    this._clockWrapper.destroy();
                    this._clockWrapper = null;
                }
                if (this._customClockBox) {
                    this._customClockBox.destroy();
                    this._customClockBox = null;
                    this._customDateLabel = null;
                    this._customTimeLabel = null;
                }
                if (this._bannerButton) {
                    this._bannerButton.destroy();
                    this._bannerButton = null;
                }
                if (this._bannerSpacer) {
                    this._bannerSpacer.destroy();
                    this._bannerSpacer = null;
                }
                if (this._bannerAppLabel) {
                    this._bannerAppLabel.destroy();
                    this._bannerAppLabel = null;
                }
                if (this._bannerBodyLabel) {
                    this._bannerBodyLabel.destroy();
                    this._bannerBodyLabel = null;
                }
                if (this._bannerTextWrapper) {
                    this._bannerTextWrapper.destroy();
                    this._bannerTextWrapper = null;
                }
                this._bannerAppRow = null;
                if (this._bannerLabel) {
                    this._bannerLabel.destroy();
                    this._bannerLabel = null;
                }
                if (this._bannerIcon) {
                    this._bannerIcon.destroy();
                    this._bannerIcon = null;
                }
                this._bannerBox = null;
                this._currentNotification = null;
            }

            if (dateMenu._indicator) {
                if (this._originalIndicatorStyle !== undefined) {
                    dateMenu._indicator.style = this._originalIndicatorStyle;
                }
                dateMenu._indicator.show();
            }

            if (this._enterId) dateMenu.disconnect(this._enterId);
            if (this._leaveId) dateMenu.disconnect(this._leaveId);
            if (this._menuLeaveId) dateMenu.menu.actor.disconnect(this._menuLeaveId);
            if (this._menuEnterId) dateMenu.menu.actor.disconnect(this._menuEnterId);
            if (this._openStateId) dateMenu.menu.disconnect(this._openStateId);

            // Restore native calendar header layout
            this._removeCalendarHeaderButtons(dateMenu);

            // Clean up injected filter row and restore native state
            if (this._filterRow) {
                let parent = this._filterRow.get_parent();
                if (parent) {
                    parent.remove_child(this._filterRow);
                }
                this._filterRow.destroy();
                this._filterRow = null;
            }

            if (dateMenu._messageList && dateMenu._messageList._sections) {
                for (let [source, section] of dateMenu._messageList._sections) {
                    let actor = section.actor || section;
                    if (actor) actor.show();

                    let messages = [];
                    const findMessages = (act) => {
                        if (!act) return;
                        let sc = act.style_class || '';
                        if (sc.includes('message') && !sc.includes('message-list') && !sc.includes('section')) {
                            messages.push(act);
                            return;
                        }
                        if (act.get_children) {
                            act.get_children().forEach(findMessages);
                        }
                    };
                    findMessages(actor);
                    messages.forEach(msg => {
                        msg.show();
                        msg.remove_style_class_name('stacked-deck');
                    });
                }
            }
            
            dateMenu.show();
        }

        const disconnect = id => { if (id) this._settings.disconnect(id); };
        disconnect(this._widthId);
        disconnect(this._heightId);
        disconnect(this._clockShowId);
        disconnect(this._dateShowId);
        disconnect(this._clockModeId);
        disconnect(this._clockCustId);
        disconnect(this._iconTypeId);
        disconnect(this._iconColorId);
        disconnect(this._hideEmptyId);
        disconnect(this._bannerPosId);
        disconnect(this._prayerTimesEnabledId);
        disconnect(this._prayerCityId);
        disconnect(this._prayerCountryId);
        disconnect(this._prayerMethodId);
        disconnect(this._prayerCountdownPositionId);

        this._stopPrayerCountdown();
        if (this._prayerBox) {
            this._prayerBox.destroy();
            this._prayerBox = null;
        }
        if (this._prayerPanelLabel) {
            this._prayerPanelLabel.destroy();
            this._prayerPanelLabel = null;
        }

        if (this._queueChangedId) {
            Main.messageTray.disconnect(this._queueChangedId);
        }
        if (this._sourceAddedId) {
            Main.messageTray.disconnect(this._sourceAddedId);
        }
        if (this._sourceRemovedId) {
            Main.messageTray.disconnect(this._sourceRemovedId);
        }

        for (let [source, id] of this._sourcesMap.entries()) {
            try { source.disconnect(id); } catch (e) {}
        }
        this._sourcesMap.clear();

        this._settings = null;
    }
}
