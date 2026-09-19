/**
 * 管理ダッシュボードの表示言語（日本語 / ベトナム語）。
 *
 * ベトナムの店舗では、現地スタッフがダッシュボードを触るため
 * 画面そのものを切り替えられるようにする。
 * 訳が用意されていない文字列は日本語のまま出す（隠さない）。
 */

export const UI_LOCALES = [
  { value: 'ja', label: '日本語' },
  { value: 'vi', label: 'Tiếng Việt' },
] as const;

export type UiLocale = (typeof UI_LOCALES)[number]['value'];

export const UI_LOCALE_COOKIE = 'ui_locale';

export function isUiLocale(value: string | undefined): value is UiLocale {
  return value === 'ja' || value === 'vi';
}

/**
 * 辞書。キーは日本語そのものにして、訳が無ければキーをそのまま出す。
 * こうしておくと、訳を足していない画面でも壊れない。
 */
const VI: Record<string, string> = {
  // --- 共通 ---
  ダッシュボード: 'Bảng điều khiển',
  メニューマスター: 'Danh mục món',
  業態管理: 'Quản lý thương hiệu',
  店舗管理: 'Quản lý cửa hàng',
  本部機能: 'Chức năng trụ sở',
  経営管理: 'Quản trị kinh doanh',
  集客: 'Thu hút khách',
  設定: 'Cài đặt',
  CRM: 'CRM',
  アンケート分析: 'Phân tích khảo sát',
  'データ出力・連携': 'Xuất dữ liệu',
  業態: 'Thương hiệu',

  新規作成: 'Tạo mới',
  編集: 'Sửa',
  削除: 'Xóa',
  保存: 'Lưu',
  キャンセル: 'Hủy',
  '更 新': 'Cập nhật',
  '作 成': 'Tạo',
  '追 加': 'Thêm',
  検索: 'Tìm kiếm',
  クリア: 'Xóa lọc',
  表示順: 'Thứ tự hiển thị',
  表示順編集: 'Sửa thứ tự',
  店舗名: 'Tên cửa hàng',
  未設定: 'Chưa đặt',
  データがありません: 'Không có dữ liệu',
  ログアウト: 'Đăng xuất',

  // --- POS サイドメニュー ---
  顧客分析: 'Phân tích khách hàng',
  メニュー: 'Món',
  プラン: 'Gói',
  オプション: 'Tùy chọn',
  カテゴリ: 'Danh mục',
  おすすめメニュー: 'Món đề xuất',
  メニュー一括編集: 'Sửa hàng loạt (CSV)',
  業態一覧: 'Danh sách thương hiệu',
  支払方法等設定: 'Phương thức thanh toán',
  自動翻訳設定: 'Dịch tự động',
  お通し自動設定: 'Món khai vị tự động',
  自動釣銭機設定: 'Máy thối tiền tự động',
  モバイルオーダーデザイン: 'Giao diện đặt món',
  店舗一覧: 'Danh sách cửa hàng',
  取扱メニュー一覧: 'Món theo cửa hàng',
  アプリ表示時間設定: 'Giờ hiển thị trên app',
  キッチンプリンター一覧: 'Máy in bếp',
  店員: 'Nhân viên',
  プランオプション印刷設定: 'In tùy chọn gói',
  デシャップグループ: 'Nhóm ra món',
  調理アイテム: 'Hạng mục chế biến',
  'キッチン表示・印刷順': 'Thứ tự hiển thị bếp',
  ハンディ管理: 'Quản lý máy cầm tay',
  テーブル: 'Bàn',
  アプリ表示確認: 'Xem trước app',
  配布物: 'Tài liệu phát',

  メッセージ配信: 'Gửi tin nhắn',
  クーポン: 'Phiếu giảm giá',
  ミニゲーム: 'Mini game',
  会員ランク管理: 'Hạng thành viên',
  クーポン自動配信: 'Gửi phiếu tự động',
  ' 配信アカウント（LINE / Zalo）': 'Tài khoản gửi tin (LINE / Zalo)',
  '配信アカウント（LINE / Zalo）': 'Tài khoản gửi tin (LINE / Zalo)',
  アンケート設定: 'Cài đặt khảo sát',

  日次処理一覧: 'Chốt ca hàng ngày',
  会計履歴一覧: 'Lịch sử thanh toán',
  テーブル利用履歴: 'Lịch sử sử dụng bàn',
  重要操作履歴一覧: 'Lịch sử thao tác quan trọng',
  キャッシュレス決済履歴: 'Lịch sử thanh toán không tiền mặt',
  レポートくん設定: 'Báo cáo tự động',
  CSVダウンロード: 'Tải CSV',

  店舗スコア一覧: 'Điểm theo cửa hàng',
  コメント一覧: 'Danh sách bình luận',
  店舗詳細: 'Chi tiết cửa hàng',
  スタッフ評価分析: 'Đánh giá nhân viên',
  メニュー評価分析: 'Đánh giá món',

  // --- 経営管理 ---
  店舗管理ダッシュボード: 'Bảng điều khiển cửa hàng',
  売上速報: 'Doanh thu nhanh',
  日報: 'Báo cáo ngày',
  '月次 PL': 'Báo cáo lãi lỗ tháng',
  目標設定: 'Đặt mục tiêu',
  売上分析: 'Phân tích doanh thu',
  商品分析: 'Phân tích sản phẩm',
  '曜日・時間帯別': 'Theo thứ và khung giờ',
  売上予測: 'Dự báo doanh thu',
  仕入れ登録: 'Nhập hàng',
  小口現金: 'Tiền mặt lẻ',
  収支登録: 'Thu chi',
  科目登録: 'Tài khoản kế toán',
  取引先登録: 'Nhà cung cấp',

  // --- AI / 集客 ---
  'AI 店舗診断': 'Chẩn đoán cửa hàng AI',
  集客ダッシュボード: 'Bảng điều khiển thu hút khách',
  店舗診断: 'Chẩn đoán cửa hàng',

  // --- 設定 ---
  アカウント一覧: 'Danh sách tài khoản',
  権限設定: 'Phân quyền',
  店舗グループ設定: 'Nhóm cửa hàng',

  // --- 指標 ---
  売上: 'Doanh thu',
  当月売上: 'Doanh thu tháng này',
  客数: 'Số khách',
  組数: 'Số nhóm',
  客単価: 'Chi tiêu/khách',
  '1 日あたり売上': 'Doanh thu mỗi ngày',
  日別の売上: 'Doanh thu theo ngày',
  店舗別: 'Theo cửa hàng',
  '売れ筋メニュー（上位 10 品）': 'Món bán chạy (Top 10)',
  合計: 'Tổng',
  達成率: 'Tỷ lệ đạt',
  目標: 'Mục tiêu',
  原価率: 'Tỷ lệ giá vốn',
  人件費率: 'Tỷ lệ nhân công',
  営業利益: 'Lợi nhuận kinh doanh',

  // --- 一覧の列でよく出るもの ---
  メニュー名: 'Tên món',
  出数: 'Số lượng bán',
  在庫: 'Tồn kho',
  取扱: 'Có bán',
  '公開（お客様）': 'Hiển thị cho khách',
  '公開（スタッフ）': 'Hiển thị cho nhân viên',
  価格: 'Giá',
  金額: 'Số tiền',
  件数: 'Số lượng',
  日付: 'Ngày',
  時間: 'Giờ',
  状態: 'Trạng thái',
  担当: 'Phụ trách',
  備考: 'Ghi chú',
  チャネル: 'Kênh',
  アカウント名: 'Tên tài khoản',
  配信アカウント: 'Tài khoản gửi tin',
  配信アカウント一覧: 'Danh sách tài khoản gửi tin',
  'メッセージを送るための公式アカウント（LINE / Zalo）':
    'Tài khoản chính thức để gửi tin nhắn (LINE / Zalo)',
  'LINE 友だち数': 'Số bạn bè LINE',
  'Zalo フォロワー数': 'Số người theo dõi Zalo',
  アカウント数: 'Số tài khoản',
  月間送信可能数: 'Hạn mức gửi hàng tháng',
  'ZNS 上限': 'Hạn mức ZNS',
  '友だち・フォロワー': 'Bạn bè / Người theo dõi',
  有効: 'Đang hoạt động',
  ブロック: 'Đã chặn',
  アカウントが登録されていません: 'Chưa có tài khoản nào',

  // --- 科目・取引先・仕入れ ---
  科目: 'Tài khoản kế toán',
  取引先: 'Nhà cung cấp',
  仕入れ: 'Nhập hàng',
  収支: 'Thu chi',
  キッチンプリンター: 'Máy in bếp',
  キッチンプリンター名: 'Tên máy in bếp',
  店員名: 'Tên nhân viên',
  表示: 'Hiển thị',
  調理アイテム名: 'Tên hạng mục chế biến',
  デシャップグループ名: 'Tên nhóm ra món',
};

const DICTIONARIES: Record<UiLocale, Record<string, string>> = {
  ja: {},
  vi: VI,
};

/** 訳が無ければ日本語をそのまま返す */
export function translate(locale: UiLocale, text: string): string {
  if (locale === 'ja') return text;
  return DICTIONARIES[locale][text] ?? text;
}

/** 画面から使う。`t('売上')` のように呼ぶ */
export function makeTranslator(locale: UiLocale) {
  return (text: string) => translate(locale, text);
}
