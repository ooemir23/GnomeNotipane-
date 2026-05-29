import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {ExtensionPreferences, gettext as originalGettext} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

// Turkish Translation dictionary
const isTurkish = GLib.get_language_names().some(lang => lang.startsWith('tr'));

const tr = {
    'Notifications': 'Bildirimler',
    'No notifications': 'Bildirim yok',
    'Clear': 'Temizle',
    'Clear All': 'Hepsini Temizle',
    'Settings': 'Ayarlar',
    'Search notifications...': 'Bildirimlerde ara...',
    'Pinned': 'Sabitlenmiş',
    'Dismiss Group': 'Grubu Kapat',
    'Show More': 'Daha Fazla Göster',
    'Show Less': 'Daha Az Göster',
    'DND': 'Sessiz',
    'DND On': 'Sessiz: Açık',
    'Prayer Times': 'Namaz Vakitleri',
    'Namaz Vakitleri Ayarları': 'Namaz Vakitleri Ayarları',
    'Namaz vakitlerini takvim menüsünde görüntüleme seçenekleri.': 'Namaz vakitlerini takvim menüsünde görüntüleme seçenekleri.',
    'Enable Prayer Times': 'Namaz Vakitlerini Etkinleştir',
    'Show daily prayer times in the calendar dropdown': 'Takvim menüsünün üstünde günlük namaz vakitlerini göster',
    'City': 'Şehir',
    'Country': 'Ülke',
    'Calculation Method': 'Hesaplama Yöntemi',
    'Enable Adhan audio alert': 'Ezan / Vakit Bildirimini Etkinleştir',
    'Play a notification sound when a prayer time arrives': 'Vakit geldiğinde uyarı sesi/bildirim çal',
    'Adhan Sound File Path': 'Ezan / Uyarı Ses Dosyası Yolu',
    'Panel Position & Hover': 'Panel Konumu ve Hover',
    'Configure where the notification panel is placed and how it opens': 'Bildirim panelinin konumunu ve nasıl açılacağını yapılandırın',
    'Hide When No Notifications': 'Bildirim Yokken Gizle',
    'Hide the top bar indicator if there are no unread notifications': 'Okunmamış bildirim yoksa üst bar göstergesini gizle',
    'Panel Position': 'Panel Konumu',
    'Select where to put the indicator in the top panel (Left, Center, Right)': 'Göstergenin üst panelde nereye yerleştirileceğini seçin (Sol, Orta, Sağ)',
    'Left': 'Sol',
    'Center': 'Orta',
    'Right': 'Sağ',
    'Panel Index Position': 'Panel Sıralama İndeksi',
    'Adjust order of the indicator in the panel section (0-100)': 'Panel bölümündeki gösterge sırasını ayarlayın (0-100)',
    'Hover to Show Menu': 'Mouse ile Üzerine Gelince Göster',
    'Automatically open the menu when hovering the mouse over the indicator': 'Mouse göstergenin üzerindeyken menüyü otomatik olarak aç',
    'Hover Close Delay (ms)': 'Kapanma Gecikmesi (ms)',
    'Delay in milliseconds before closing the menu after hover out (200-3000)': 'Mouse ayrıldıktan sonra menünün kapanması için beklenecek süre (200-3000 ms)',
    'Banner & Sound Options': 'Banner ve Ses Seçenekleri',
    'Configure incoming temporary banners and notification sound alerts': 'Gelen geçici banner bildirimlerini ve sesli uyarıları yapılandırın',
    'Banner Display Duration (seconds)': 'Banner Gösterim Süresi (saniye)',
    'How long incoming notifications remain open on the panel': 'Gelen bildirimlerin panelde ne kadar süre açık kalacağı',
    'Banner Maximum Width (px)': 'Banner Maksimum Genişliği (px)',
    'Configure the maximum width of the banner text in the top bar': 'Üst bardaki banner metninin maksimum genişliğini yapılandırın',
    'Banner Height (px)': 'Banner Yüksekliği (px)',
    'Configure the height of the banner text in the top bar': 'Üst bardaki banner metninin yüksekliğini yapılandırın',
    'Show Application Icon in Banner': 'Banner\'da Uygulama İkonunu Göster',
    'Display the application icon next to the text banner': 'Metin banner\'ının yanında uygulama ikonunu göster',
    'Enable Scrolling Marquee': 'Kayar Yazıyı (Marquee) Etkinleştir',
    'Scroll long notification text inside the top bar banner': 'Üst bar banner\'ı içindeki uzun bildirim metinlerini kaydır',
    'Scrolling Speed (ms)': 'Kayma Hızı (ms)',
    'Text update delay in milliseconds (smaller means faster scroll)': 'Milisaniye cinsinden metin güncelleme gecikmesi (küçük değer daha hızlı kaydırır)',
    'Enable Sound Alert': 'Sesli Bildirimi Etkinleştir',
    'Play a sound when a new notification is received': 'Yeni bir bildirim alındığında ses çal',
    'Sound File Path': 'Ses Dosyası Yolu',
    'Menu Styling & Themes': 'Menü Stili ve Temalar',
    'Configure the appearance and theme of the notification dropdown menu': 'Bildirim açılır menüsünün görünümünü ve temasını yapılandırın',
    'Menu Width (px)': 'Menü Genişliği (px)',
    'Adjust the width of the notification popup menu': 'Bildirim açılır menüsünün genişliğini ayarlayın',
    'Menu Maximum Height (px)': 'Menü Maksimum Yüksekliği (px)',
    'Set the maximum height of the notification list before scrolling': 'Kaydırma öncesi bildirim listesinin maksimum yüksekliğini ayarlayın',
    'Theme Style': 'Tema Stili',
    'Select visual styling theme (Glassmorphic translucent, Dark, Solid)': 'Görsel stil temasını seçin (Yarı şeffaf Cam, Koyu, Düz)',
    'Glassmorphic': 'Yarı Şeffaf Cam',
    'Dark': 'Koyu Tema',
    'Solid': 'Düz Tema',
    'Indicator Icon Style': 'Gösterge İkon Stili',
    'Select indicator icon type in the top bar': 'Üst bardaki gösterge ikon tipini seçin',
    'Bell Icon': 'Çan İkonu',
    'Bell with Badge': 'Rozetli Çan',
    'Simple Dot': 'Basit Nokta',
    'Indicator Icon Color (Hex)': 'Gösterge İkon Rengi (Hex)',
    'Popover Layout': 'Menü Tasarım Düzeni',
    'Select the layout style of the dropdown menu': 'Açılır menünün tasarım düzenini seçin (Takvim + Bildirimler, Bildirimler Only vb.)',
    'Calendar + Notifications': 'Takvim (Sol) + Bildirimler (Sağ)',
    'Notifications + Calendar': 'Bildirimler (Sol) + Takvim (Sağ)',
    'Notifications Only': 'Sadece Bildirimler',
    'Calendar Only': 'Sadece Takvim',
    'Test Notifications': 'Test Bildirimleri',
    'Send test notifications to verify layouts, themes, and colors': 'Arayüz düzenini, temaları ve renkleri doğrulamak için test bildirimleri gönderin',
    'Send Normal Test Notification': 'Normal Test Bildirimi Gönder',
    'Verifies text display, sounds, and scrolling banner': 'Yazı gösterimini, sesleri ve kayar panel banner\'ını test eder',
    'Send Approval Test Notification': 'Onay Bildirimi Gönder',
    'Verifies distinct warning color highlighting for interactive requests': 'İnteraktif onay istekleri için farklı renkteki vurgulamayı test eder',
    'Test': 'Test Et',
    'Test Approval': 'Onayı Test Et',
    'Show Clock in Panel': 'Panelde Saati Göster',
    'Show current time on the top bar panel button': 'Üst bar panel butonunda güncel saati göster',
    'Show Date in Panel': 'Panelde Tarihi Göster',
    'Show current date next to the clock in the panel': 'Panelde saatin yanında güncel tarihi göster',
    'Banner Position relative to Clock': 'Banner Konumu (Saate Göre)',
    'Select where the incoming notification banner appears relative to the clock': 'Gelen bildirim banner\'ının saate göre nerede görüntüleneceğini seçin',
    'Left of Clock': 'Saatin Solunda',
    'Right of Clock': 'Saatin Sağında',
    'Replace Clock': 'Saatin Yerine (Geçici)',
    'Dropdown Menu Only': 'Sadece Açılır Menüde (Üst barda gösterme)',
    'Clock Display Format': 'Saat Gösterim Formatı',
    'Select how the clock and date are formatted in the top bar': 'Üst bardaki saat ve tarihin nasıl formatlanacağını seçin',
    'Standard (24h)': 'Standart (24 Saat)',
    'Standard with Seconds': 'Standart (Saniyeli)',
    '12-Hour (AM/PM)': '12 Saat (ÖÖ/ÖS)',
    '12-Hour with Seconds': '12 Saat (Saniyeli)',
    'Two Lines (Date / Time 24h)': 'İki Satırlı (Tarih-Gün / Saat 24h)',
    'Two Lines (Date / Time 12h)': 'İki Satırlı (Tarih-Gün / Saat 12h)',
    'Two Lines (Date / Day & Time)': 'İki Satırlı (Tarih / Gün & Saat)',
    'Custom Format': 'Özel Format',
    'Custom Clock Format String': 'Özel Saat Formatı Metni',
    'DateTime format (e.g. %d %b %H:%M)': 'DateTime format metni (Örn: %d %b %H:%M)',
    'Clock & Date Display': 'Saat ve Tarih Gösterimi',
    'Configure clock format and date visibility options': 'Saat formatı ve tarih görünürlüğü seçeneklerini yapılandırın',
    'Banner Excluded Apps (Blacklist)': 'Banner Kara Listesi (Uygulamalar)'
};

function _(str) {
    if (isTurkish && tr[str]) {
        return tr[str];
    }
    try {
        return originalGettext(str);
    } catch (e) {
        return str;
    }
}

export default class NotiPanelPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // Page 1: Panel Positioning & Hover
        const pagePosition = new Adw.PreferencesPage({
            title: _('Panel Position & Hover'),
            icon_name: 'preferences-system-notifications-symbolic',
        });
        window.add(pagePosition);

        // Group 1: Panel Positioning & Hover
        const positionGroup = new Adw.PreferencesGroup({
            description: _('Configure where the notification panel is placed and how it opens'),
        });
        pagePosition.add(positionGroup);

        // Hide when empty row
        const hideRow = new Adw.SwitchRow({
            title: _('Hide When No Notifications'),
            subtitle: _('Hide the top bar indicator if there are no unread notifications'),
        });
        settings.bind('hide-when-empty', hideRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        positionGroup.add(hideRow);

        // Panel Position dropdown
        const positionRow = new Adw.ComboRow({
            title: _('Panel Position'),
            subtitle: _('Select where to put the indicator in the top panel (Left, Center, Right)'),
            model: Gtk.StringList.new([_('Left'), _('Center'), _('Right')]),
        });
        const positions = ['left', 'center', 'right'];
        let currentPos = settings.get_string('panel-position');
        let posIndex = positions.indexOf(currentPos);
        positionRow.selected = posIndex !== -1 ? posIndex : 2; // Default to 'right' (index 2)
        positionRow.connect('notify::selected', () => {
            settings.set_string('panel-position', positions[positionRow.selected]);
        });
        positionGroup.add(positionRow);

        // Panel Index row
        const indexRow = new Adw.SpinRow({
            title: _('Panel Index Position'),
            subtitle: _('Adjust order of the indicator in the panel section (0-100)'),
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 100,
                step_increment: 1,
                value: settings.get_int('panel-index'),
            }),
        });
        settings.bind('panel-index', indexRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        positionGroup.add(indexRow);

        // Hover to show row
        const hoverRow = new Adw.SwitchRow({
            title: _('Hover to Show Menu'),
            subtitle: _('Automatically open the menu when hovering the mouse over the indicator'),
        });
        settings.bind('hover-to-show', hoverRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        positionGroup.add(hoverRow);

        // Hover close delay row
        const delayRow = new Adw.SpinRow({
            title: _('Hover Close Delay (ms)'),
            subtitle: _('Delay in milliseconds before closing the menu after hover out (200-3000)'),
            adjustment: new Gtk.Adjustment({
                lower: 200,
                upper: 3000,
                step_increment: 50,
                value: settings.get_int('hover-close-delay'),
            }),
        });
        settings.bind('hover-close-delay', delayRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        positionGroup.add(delayRow);

        // Banner Position relative to Clock ComboRow
        const bannerPosRow = new Adw.ComboRow({
            title: _('Banner Position relative to Clock'),
            subtitle: _('Select where the incoming notification banner appears relative to the clock'),
            model: Gtk.StringList.new([
                _('Left of Clock'),
                _('Right of Clock'),
                _('Replace Clock'),
                _('Dropdown Menu Only')
            ]),
        });
        const bannerPositions = ['left', 'right', 'replace', 'dropdown-only'];
        let currentBannerPos = settings.get_string('banner-position-relative-to-clock');
        let bannerPosIndex = bannerPositions.indexOf(currentBannerPos);
        bannerPosRow.selected = bannerPosIndex !== -1 ? bannerPosIndex : 0;
        bannerPosRow.connect('notify::selected', () => {
            settings.set_string('banner-position-relative-to-clock', bannerPositions[bannerPosRow.selected]);
        });
        positionGroup.add(bannerPosRow);


        // ── Page 1b: Clock & Date Display ──
        const pageClock = new Adw.PreferencesPage({
            title: _('Clock & Date Display'),
            icon_name: 'preferences-system-time-symbolic',
        });
        window.add(pageClock);

        const clockGroup = new Adw.PreferencesGroup({
            description: _('Configure clock format and date visibility options'),
        });
        pageClock.add(clockGroup);

        // Show Clock in Panel SwitchRow
        const showClockRow = new Adw.SwitchRow({
            title: _('Show Clock in Panel'),
            subtitle: _('Show current time on the top bar panel button'),
        });
        settings.bind('panel-show-clock', showClockRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        clockGroup.add(showClockRow);

        // Show Date in Panel SwitchRow
        const showDateRow = new Adw.SwitchRow({
            title: _('Show Date in Panel'),
            subtitle: _('Show current date next to the clock in the panel'),
        });
        settings.bind('panel-show-date', showDateRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        clockGroup.add(showDateRow);

        // Clock Display Format ComboRow
        const clockModeRow = new Adw.ComboRow({
            title: _('Clock Display Format'),
            subtitle: _('Select how the clock and date are formatted in the top bar'),
            model: Gtk.StringList.new([
                _('Standard (24h)'),
                _('Standard with Seconds'),
                _('12-Hour (AM/PM)'),
                _('12-Hour with Seconds'),
                _('Two Lines (Date / Time 24h)'),
                _('Two Lines (Date / Time 12h)'),
                _('Two Lines (Date / Day & Time)'),
                _('Custom Format')
            ]),
        });
        const clockModes = ['standard', 'standard-with-seconds', '12h', '12h-with-seconds', 'two-lines', 'two-lines-12h', 'two-lines-date-day-time', 'custom'];
        let currentClockMode = settings.get_string('clock-format-mode');
        let clockModeIndex = clockModes.indexOf(currentClockMode);
        clockModeRow.selected = clockModeIndex !== -1 ? clockModeIndex : 0;
        clockModeRow.connect('notify::selected', () => {
            settings.set_string('clock-format-mode', clockModes[clockModeRow.selected]);
            customFormatRow.sensitive = (clockModes[clockModeRow.selected] === 'custom');
        });
        clockGroup.add(clockModeRow);

        // Custom Clock Format entry
        const customFormatRow = new Adw.EntryRow({
            title: _('Custom Clock Format String'),
            text: settings.get_string('clock-custom-format'),
        });
        customFormatRow.sensitive = (currentClockMode === 'custom');
        settings.bind('clock-custom-format', customFormatRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        clockGroup.add(customFormatRow);

        // Set up sensitivity
        showDateRow.sensitive = showClockRow.active;
        clockModeRow.sensitive = showClockRow.active;
        customFormatRow.sensitive = showClockRow.active && (currentClockMode === 'custom');
        showClockRow.connect('notify::active', () => {
            showDateRow.sensitive = showClockRow.active;
            clockModeRow.sensitive = showClockRow.active;
            customFormatRow.sensitive = showClockRow.active && (clockModes[clockModeRow.selected] === 'custom');
        });


        // Page 2: Banner & Sound Options
        const pageBanner = new Adw.PreferencesPage({
            title: _('Banner & Sound Options'),
            icon_name: 'audio-x-generic-symbolic',
        });
        window.add(pageBanner);

        // Group 2: Banner & Sound Options
        const bannerGroup = new Adw.PreferencesGroup({
            description: _('Configure incoming temporary banners and notification sound alerts'),
        });
        pageBanner.add(bannerGroup);

        // Display Timeout row
        const timeoutRow = new Adw.SpinRow({
            title: _('Banner Display Duration (seconds)'),
            subtitle: _('How long incoming notifications remain open on the panel'),
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 30,
                step_increment: 1,
                value: settings.get_int('display-timeout'),
            }),
        });
        settings.bind('display-timeout', timeoutRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        bannerGroup.add(timeoutRow);

        // Banner Max Width row
        const bannerWidthRow = new Adw.SpinRow({
            title: _('Banner Maximum Width (px)'),
            subtitle: _('Configure the maximum width of the banner text in the top bar'),
            adjustment: new Gtk.Adjustment({
                lower: 100,
                upper: 600,
                step_increment: 10,
                value: settings.get_int('banner-max-width'),
            }),
        });
        settings.bind('banner-max-width', bannerWidthRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        bannerGroup.add(bannerWidthRow);

        // Banner Height row
        const bannerHeightRow = new Adw.SpinRow({
            title: _('Banner Height (px)'),
            subtitle: _('Configure the height of the banner text in the top bar'),
            adjustment: new Gtk.Adjustment({
                lower: 20,
                upper: 100,
                step_increment: 2,
                value: settings.get_int('banner-height'),
            }),
        });
        settings.bind('banner-height', bannerHeightRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        bannerGroup.add(bannerHeightRow);

        // Show banner icon row
        const bannerIconRow = new Adw.SwitchRow({
            title: _('Show Application Icon in Banner'),
            subtitle: _('Display the application icon next to the text banner'),
        });
        settings.bind('show-banner-icon', bannerIconRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        bannerGroup.add(bannerIconRow);

        // Enable scroll marquee row
        const scrollEnabledRow = new Adw.SwitchRow({
            title: _('Enable Scrolling Marquee'),
            subtitle: _('Scroll long notification text inside the top bar banner'),
        });
        settings.bind('banner-scroll-enabled', scrollEnabledRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        bannerGroup.add(scrollEnabledRow);

        // Scroll speed row
        const scrollSpeedRow = new Adw.SpinRow({
            title: _('Scrolling Speed (ms)'),
            subtitle: _('Text update delay in milliseconds (smaller means faster scroll)'),
            adjustment: new Gtk.Adjustment({
                lower: 50,
                upper: 1000,
                step_increment: 10,
                value: settings.get_int('banner-scroll-speed'),
            }),
        });
        settings.bind('banner-scroll-speed', scrollSpeedRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        bannerGroup.add(scrollSpeedRow);

        // Sound Switch row
        const soundRow = new Adw.SwitchRow({
            title: _('Enable Sound Alert'),
            subtitle: _('Play a sound when a new notification is received'),
        });
        settings.bind('enable-sound', soundRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        bannerGroup.add(soundRow);

        // Sound File entry
        const soundFileRow = new Adw.EntryRow({
            title: _('Sound File Path'),
            text: settings.get_string('sound-file'),
        });
        settings.bind('sound-file', soundFileRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        bannerGroup.add(soundFileRow);

        // Blacklist apps entry
        const blacklistRow = new Adw.EntryRow({
            title: _('Banner Excluded Apps (Blacklist)'),
            text: settings.get_string('banner-blacklist'),
        });
        settings.bind('banner-blacklist', blacklistRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        bannerGroup.add(blacklistRow);


        // Page 3: Menu Styling & Themes
        const pageMenu = new Adw.PreferencesPage({
            title: _('Menu Styling & Themes'),
            icon_name: 'preferences-desktop-theme-symbolic',
        });
        window.add(pageMenu);

        // Group 3: Menu Styling & Themes
        const menuGroup = new Adw.PreferencesGroup({
            description: _('Configure the appearance and theme of the notification dropdown menu'),
        });
        pageMenu.add(menuGroup);


        // Menu Width row
        const menuWidthRow = new Adw.SpinRow({
            title: _('Menu Width (px)'),
            subtitle: _('Adjust the width of the notification popup menu'),
            adjustment: new Gtk.Adjustment({
                lower: 250,
                upper: 1000,
                step_increment: 10,
                value: settings.get_int('menu-width'),
            }),
        });
        settings.bind('menu-width', menuWidthRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        menuGroup.add(menuWidthRow);

        // Menu Max Height row
        const menuHeightRow = new Adw.SpinRow({
            title: _('Menu Maximum Height (px)'),
            subtitle: _('Set the maximum height of the notification list before scrolling'),
            adjustment: new Gtk.Adjustment({
                lower: 200,
                upper: 1000,
                step_increment: 10,
                value: settings.get_int('menu-max-height'),
            }),
        });
        settings.bind('menu-max-height', menuHeightRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        menuGroup.add(menuHeightRow);

        // Theme Style ComboRow
        const themeRow = new Adw.ComboRow({
            title: _('Theme Style'),
            subtitle: _('Select visual styling theme (Glassmorphic translucent, Dark, Solid)'),
            model: Gtk.StringList.new([_('Glassmorphic'), _('Dark'), _('Solid')]),
        });
        const themes = ['glass', 'dark', 'solid'];
        let currentTheme = settings.get_string('theme-style');
        let themeIndex = themes.indexOf(currentTheme);
        themeRow.selected = themeIndex !== -1 ? themeIndex : 0;
        themeRow.connect('notify::selected', () => {
            settings.set_string('theme-style', themes[themeRow.selected]);
        });
        menuGroup.add(themeRow);

        // Indicator Icon Style ComboRow
        const iconRow = new Adw.ComboRow({
            title: _('Indicator Icon Style'),
            subtitle: _('Select indicator icon type in the top bar'),
            model: Gtk.StringList.new([_('Bell Icon'), _('Bell with Badge'), _('Simple Dot')]),
        });
        const icons = ['bell', 'bell-badge', 'dot'];
        let currentIcon = settings.get_string('indicator-icon-type');
        let iconIndex = icons.indexOf(currentIcon);
        iconRow.selected = iconIndex !== -1 ? iconIndex : 0;
        iconRow.connect('notify::selected', () => {
            settings.set_string('indicator-icon-type', icons[iconRow.selected]);
        });
        menuGroup.add(iconRow);

        // Indicator Color entry
        const colorRow = new Adw.EntryRow({
            title: _('Indicator Icon Color (Hex)'),
            text: settings.get_string('indicator-color'),
        });
        settings.bind('indicator-color', colorRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        menuGroup.add(colorRow);


        // Page 4: Test Notifications
        const pageTest = new Adw.PreferencesPage({
            title: _('Test Notifications'),
            icon_name: 'system-run-symbolic',
        });
        window.add(pageTest);

        // Group 4: Test Notifications
        const testGroup = new Adw.PreferencesGroup({
            description: _('Send test notifications to verify layouts, themes, and colors'),
        });
        pageTest.add(testGroup);

        // Normal Test Notification Row
        const normalTestRow = new Adw.ActionRow({
            title: _('Send Normal Test Notification'),
            subtitle: _('Verifies text display, sounds, and scrolling banner'),
        });
        const normalBtn = new Gtk.Button({
            label: _('Test'),
            valign: Gtk.Align.CENTER,
        });
        normalBtn.connect('clicked', () => {
            try {
                Gio.Subprocess.new(['notify-send', 'Firefox', 'Bu normal bir test bildirimidir. Kayar yazi ve ses efektini test etmek icin gonderilmistir.'], Gio.SubprocessFlags.NONE);
            } catch (e) {}
        });
        normalTestRow.add_suffix(normalBtn);
        testGroup.add(normalTestRow);

        // Approval Test Notification Row
        const approvalTestRow = new Adw.ActionRow({
            title: _('Send Approval Test Notification'),
            subtitle: _('Verifies distinct warning color highlighting for interactive requests'),
        });
        const approvalBtn = new Gtk.Button({
            label: _('Test Approval'),
            valign: Gtk.Align.CENTER,
        });
        approvalBtn.connect('clicked', () => {
            try {
                Gio.Subprocess.new(['notify-send', 'Antigravity', 'Dosya okuma izni istiyor: /home/ooemir/.gemini/antigravity (Lütfen onaylayın)'], Gio.SubprocessFlags.NONE);
            } catch (e) {}
        });
        approvalTestRow.add_suffix(approvalBtn);
        testGroup.add(approvalTestRow);

        // Page 5: Notification History
        const pageHistory = new Adw.PreferencesPage({
            title: _('Notification History') || 'Bildirim Geçmişi',
            icon_name: 'document-open-recent-symbolic',
        });
        window.add(pageHistory);

        const historyGroup = new Adw.PreferencesGroup({
            description: _('Cleared or dismissed notification history (Last 50)') || 'Kapatılmış veya silinmiş son 50 bildirim geçmişi',
        });
        pageHistory.add(historyGroup);

        const clearRow = new Adw.ActionRow({
            title: _('Clear History') || 'Geçmişi Temizle',
        });
        const clearBtn = new Gtk.Button({
            label: _('Clear') || 'Temizle',
            valign: Gtk.Align.CENTER,
        });
        clearBtn.add_css_class('destructive-action');
        clearRow.add_suffix(clearBtn);
        historyGroup.add(clearRow);

        const getHistoryFile = () => {
            let dirPath = GLib.build_filenamev([GLib.get_user_config_dir(), 'notipanel']);
            return GLib.build_filenamev([dirPath, 'history.json']);
        };

        const loadHistoryItems = () => {
            if (historyGroup._rows) {
                historyGroup._rows.forEach(r => historyGroup.remove(r));
            }
            historyGroup._rows = [];

            let filePath = getHistoryFile();
            if (!GLib.file_test(filePath, GLib.FileTest.EXISTS)) return;

            try {
                let [ok, content] = GLib.file_get_contents(filePath);
                if (ok) {
                    let decoder = new TextDecoder('utf-8');
                    let str = decoder.decode(content);
                    let history = JSON.parse(str) || [];
                    
                    history.forEach(item => {
                        let row = new Adw.ActionRow({
                            title: `${item.title || ''}`,
                            subtitle: `${item.body || ''}`,
                        });
                        let labelApp = new Gtk.Label({
                            label: `${item.app} (${item.timestamp})`,
                            valign: Gtk.Align.CENTER,
                        });
                        labelApp.add_css_class('dim-label');
                        row.add_suffix(labelApp);
                        historyGroup.add(row);
                        historyGroup._rows.push(row);
                    });
                }
            } catch (e) {
                log("Error loading history: " + e);
            }
        };

        clearBtn.connect('clicked', () => {
            let filePath = getHistoryFile();
            try {
                GLib.file_set_contents(filePath, '[]');
                loadHistoryItems();
            } catch (e) {}
        });

        loadHistoryItems();

        // Page 6: Namaz Vakitleri (Prayer Times)
        const pagePrayer = new Adw.PreferencesPage({
            title: _('Prayer Times') || 'Namaz Vakitleri',
            icon_name: 'alarm-symbolic',
        });
        window.add(pagePrayer);

        const prayerGroup = new Adw.PreferencesGroup({
            title: _('Namaz Vakitleri Ayarları') || 'Namaz Vakitleri Ayarları',
            description: _('Namaz vakitlerini takvim menüsünde görüntüleme seçenekleri.') || 'Namaz vakitlerini takvim menüsünde görüntüleme seçenekleri.',
        });
        pagePrayer.add(prayerGroup);

        // Enable Switch
        const enablePrayerRow = new Adw.SwitchRow({
            title: _('Enable Prayer Times') || 'Namaz Vakitlerini Etkinleştir',
            subtitle: _('Show daily prayer times in the calendar dropdown') || 'Takvim menüsünün üstünde günlük namaz vakitlerini göster',
        });
        settings.bind('enable-prayer-times', enablePrayerRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        prayerGroup.add(enablePrayerRow);

        // City Input
        const prayerCityRow = new Adw.EntryRow({
            title: _('City') || 'Şehir',
            text: settings.get_string('prayer-city')
        });
        prayerCityRow.connect('notify::text', () => {
            settings.set_string('prayer-city', prayerCityRow.text);
        });
        settings.connect('changed::prayer-city', () => {
            prayerCityRow.text = settings.get_string('prayer-city');
        });
        prayerGroup.add(prayerCityRow);

        // Country Input
        const prayerCountryRow = new Adw.EntryRow({
            title: _('Country') || 'Ülke',
            text: settings.get_string('prayer-country')
        });
        prayerCountryRow.connect('notify::text', () => {
            settings.set_string('prayer-country', prayerCountryRow.text);
        });
        settings.connect('changed::prayer-country', () => {
            prayerCountryRow.text = settings.get_string('prayer-country');
        });
        prayerGroup.add(prayerCountryRow);

        // Calculation Method Selection Row
        const methodRow = new Adw.ComboRow({
            title: _('Calculation Method') || 'Hesaplama Yöntemi',
            model: new Gtk.StringList({
                strings: [
                    'Diyanet (Turkey)',
                    'ISNA (North America)',
                    'MWL (Muslim World League)',
                    'Egypt',
                    'Umm Al-Qura (Makkah)',
                    'Karachi',
                    'Tehran',
                    'Gulf Method'
                ]
            })
        });
        const methodIds = ['13', '2', '3', '5', '4', '1', '7', '8'];
        let currentMethod = settings.get_string('prayer-method') || '13';
        let selIdx = methodIds.indexOf(currentMethod);
        if (selIdx >= 0) methodRow.selected = selIdx;
        methodRow.connect('notify::selected', () => {
            settings.set_string('prayer-method', methodIds[methodRow.selected]);
        });
        prayerGroup.add(methodRow);

        // Enable Adhan Switch
        const enableAdhanRow = new Adw.SwitchRow({
            title: _('Enable Adhan audio alert') || 'Ezan / Vakit Bildirimini Etkinleştir',
            subtitle: _('Play a notification sound when a prayer time arrives') || 'Vakit geldiğinde uyarı sesi/bildirim çal',
        });
        settings.bind('enable-adhan', enableAdhanRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        prayerGroup.add(enableAdhanRow);

        // Adhan Sound File Input
        const adhanSoundRow = new Adw.EntryRow({
            title: _('Adhan Sound File Path') || 'Ezan / Uyarı Ses Dosyası Yolu',
            text: settings.get_string('adhan-sound-file')
        });
        adhanSoundRow.connect('notify::text', () => {
            settings.set_string('adhan-sound-file', adhanSoundRow.text);
        });
        settings.connect('changed::adhan-sound-file', () => {
            adhanSoundRow.text = settings.get_string('adhan-sound-file');
        });
        prayerGroup.add(adhanSoundRow);
    }
}
