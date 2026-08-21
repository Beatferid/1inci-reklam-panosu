import type { Locale } from "./locales";

type Dict = Record<string, string>;

const az: Dict = {
  brand: "Reklam Panosu",
  navCampaigns: "Kampaniyalar",
  navNew: "Yeni kampaniya",
  navFeedback: "Geri bildiriş",
  navCatalog: "Kataloq",
  navPassword: "Şifrə",
  logout: "Çıxış",
  language: "Dil",
  wheelSection: "Şans çarxı",
  wheelIntro:
    "Müştəri QR ilə /oyun səhifəsində çarxı çevirir. Qazananda kassada «Hədiyyələrim → Aldım» ilə təslim təsdiqlənir.",
  wheelEnable: "Şans çarxını aç",
  spinsPerDay: "Şəxs başına günlük çevirmə hüququ",
  cooldown: "Çevirmələr arası gözləmə (dəqiqə)",
  claimWindow: "Hədiyyə alma müddəti (dəqiqə)",
  marketPin: "Market şifrəsi (5 rəqəm, istəyə bağlı)",
  cashierPin: "Kassir şifrəsi (5 rəqəm) — Aldım təsdiqi",
  cashierPinHint:
    "İstəyə bağlı. Boş buraxsanız müştəri «Aldım» deyəndə PIN soruşulmur; 5 rəqəm yazsanız kassir təsdiqi lazımdır.",
  brandBlock: "Brend · logo və başlıq",
  pageTitle: "Oyun səhifəsi başlığı",
  pageTitlePh: "Boşdursa kampaniya adı istifadə olunur",
  uploadLogo: "Logo yüklə",
  removeLogo: "Sil",
  winnersShow: "Qazananlar səhifəsini göstər (müştəri)",
  winnersHint:
    "Açıq olanda oyun səhifəsində günlük / həftəlik / aylıq qazanan siyahısı görünür. QR yenidən oxudulanda bu ayar tətbiq olunur.",
  winnersPeriod: "Siyahı dövrü",
  periodDay: "Günlük",
  periodWeek: "Həftəlik",
  periodMonth: "Aylıq",
  showNames: "Çarxda hədiyyə adlarını göstər",
  equalSlices: "Dilimləri bərabər göstər",
  askName: "Ad soyad soruş (aktiv)",
  nameRequired: "Ad soyad məcburi",
  save: "Yadda saxla",
  defaultLocale: "Çarxın standart dili",
  defaultLocaleHint:
    "Müştəri səhifəsində dil seçici görünür; standart dil buradan təyin olunur.",
};

const tr: Dict = {
  brand: "Reklam Panosu",
  navCampaigns: "Kampanyalar",
  navNew: "Yeni kampanya",
  navFeedback: "Geri bildirim",
  navCatalog: "Katalog",
  navPassword: "Şifre",
  logout: "Çıkış",
  language: "Dil",
  wheelSection: "Şans çarkı",
  wheelIntro:
    "Müşteri QR ile /oyun sayfasında çarkı çevirir. Kazanınca kasada «Hediyelerim → Aldım» ile teslim onaylanır.",
  wheelEnable: "Şans çarkını aç",
  spinsPerDay: "Kişi başı günlük çevirme hakkı",
  cooldown: "Çevirmeler arası bekleme (dakika)",
  claimWindow: "Hediye alma süresi (dakika)",
  marketPin: "Market şifresi (5 rakam, isteğe bağlı)",
  cashierPin: "Kasiyer şifresi (5 rakam) — Aldım onayı",
  cashierPinHint:
    "İsteğe bağlı. Boş bırakırsanız müşteri «Aldım» derken PIN sorulmaz; 5 rakam yazarsanız kasiyer onayı gerekir.",
  brandBlock: "Marka · logo & başlık",
  pageTitle: "Oyun sayfası başlığı",
  pageTitlePh: "Boşsa kampanya adı kullanılır",
  uploadLogo: "Logo yükle",
  removeLogo: "Kaldır",
  winnersShow: "Kazananlar sayfasını göster (müşteri)",
  winnersHint:
    "Açıkken oyun sayfasında günlük / haftalık / aylık kazanan listesi görünür. QR yeniden okutulunca bu ayar uygulanır.",
  winnersPeriod: "Liste dönemi",
  periodDay: "Günlük",
  periodWeek: "Haftalık",
  periodMonth: "Aylık",
  showNames: "Çarkta hediye adlarını göster",
  equalSlices: "Dilimleri eşit göster",
  askName: "Ad soyad sor (aktif)",
  nameRequired: "Ad soyad zorunlu",
  save: "Kaydet",
  defaultLocale: "Çarkın varsayılan dili",
  defaultLocaleHint:
    "Müşteri sayfasında dil seçici görünür; varsayılan dil buradan ayarlanır.",
};

const en: Dict = {
  brand: "Ad Board",
  navCampaigns: "Campaigns",
  navNew: "New campaign",
  navFeedback: "Feedback",
  navCatalog: "Catalog",
  navPassword: "Password",
  logout: "Sign out",
  language: "Language",
  wheelSection: "Prize wheel",
  wheelIntro:
    "Customers open /oyun via QR and spin. Wins are confirmed at the till with «My prizes → Claimed».",
  wheelEnable: "Enable prize wheel",
  spinsPerDay: "Spins per person per day",
  cooldown: "Cooldown between spins (minutes)",
  claimWindow: "Claim window (minutes)",
  marketPin: "Store PIN (5 digits, optional)",
  cashierPin: "Cashier PIN (5 digits) — claim confirm",
  cashierPinHint:
    "Optional. Leave empty to skip PIN on claim; set 5 digits to require cashier confirmation.",
  brandBlock: "Brand · logo & title",
  pageTitle: "Game page title",
  pageTitlePh: "Falls back to campaign name",
  uploadLogo: "Upload logo",
  removeLogo: "Remove",
  winnersShow: "Show winners page (customer)",
  winnersHint:
    "When on, the game page lists daily / weekly / monthly winners. Re-scanning the QR applies this setting.",
  winnersPeriod: "List period",
  periodDay: "Daily",
  periodWeek: "Weekly",
  periodMonth: "Monthly",
  showNames: "Show prize names on wheel",
  equalSlices: "Equal slice sizes",
  askName: "Ask for full name",
  nameRequired: "Full name required",
  save: "Save",
  defaultLocale: "Default wheel language",
  defaultLocaleHint:
    "Customers can change language on the game page; this sets the default.",
};

const ru: Dict = {
  brand: "Рекламный борд",
  navCampaigns: "Кампании",
  navNew: "Новая кампания",
  navFeedback: "Обратная связь",
  navCatalog: "Каталог",
  navPassword: "Пароль",
  logout: "Выйти",
  language: "Язык",
  wheelSection: "Колесо удачи",
  wheelIntro:
    "Клиент открывает /oyun по QR и крутит колесо. Выигрыш подтверждают на кассе через «Мои призы → Получил».",
  wheelEnable: "Включить колесо",
  spinsPerDay: "Круток на человека в день",
  cooldown: "Пауза между крутками (мин)",
  claimWindow: "Время на получение (мин)",
  marketPin: "PIN магазина (5 цифр, опционально)",
  cashierPin: "PIN кассира (5 цифр) — подтверждение",
  cashierPinHint:
    "Опционально. Пустое поле — без PIN при получении; 5 цифр — подтверждение кассира.",
  brandBlock: "Бренд · логотип и заголовок",
  pageTitle: "Заголовок игровой страницы",
  pageTitlePh: "Если пусто — название кампании",
  uploadLogo: "Загрузить логотип",
  removeLogo: "Удалить",
  winnersShow: "Показывать победителей (клиент)",
  winnersHint:
    "При включении на игровой странице виден список победителей. Повторное сканирование QR применяет настройку.",
  winnersPeriod: "Период списка",
  periodDay: "День",
  periodWeek: "Неделя",
  periodMonth: "Месяц",
  showNames: "Показывать названия призов",
  equalSlices: "Равные сектора",
  askName: "Спрашивать имя и фамилию",
  nameRequired: "Имя обязательно",
  save: "Сохранить",
  defaultLocale: "Язык колеса по умолчанию",
  defaultLocaleHint:
    "На странице игры можно сменить язык; здесь задаётся язык по умолчанию.",
};

const TABLES: Record<Locale, Dict> = { az, tr, en, ru };

export type AdminKey = keyof typeof az;

export function tAdmin(locale: Locale, key: AdminKey): string {
  return TABLES[locale][key] ?? TABLES.az[key] ?? key;
}
