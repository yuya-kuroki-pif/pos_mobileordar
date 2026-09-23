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

  // --- 今回足した画面 ---
  スコア推移: 'Diễn biến điểm số',
  カスタムアンケート: 'Khảo sát tùy chỉnh',
  メッセージ配信分析: 'Phân tích gửi tin nhắn',
  クーポン利用分析: 'Phân tích sử dụng phiếu giảm giá',
  モバイル決済取引CSV: 'CSV giao dịch thanh toán di động',
  アカウント操作履歴: 'Lịch sử thao tác tài khoản',
  クチコミ獲得: 'Đánh giá trên Google',
  営業カレンダー: 'Lịch kinh doanh',
  '性別・年代分析': 'Phân tích giới tính và độ tuổi',
  '調理・配膳時間分析': 'Phân tích thời gian chế biến và phục vụ',
  カスタムレポート: 'Báo cáo tùy chỉnh',
  'PL 店舗 月別': 'PL theo tháng (từng cửa hàng)',
  'PL 店舗 日別': 'PL theo ngày (từng cửa hàng)',
  キャッシュレス入金履歴: 'Lịch sử chuyển khoản',
  メニューアシスタント: 'Trợ lý danh mục món',
  入金履歴一覧: 'Danh sách lịch sử chuyển khoản',

  // --- 表の見出し ---
  年月: 'Năm / tháng',
  回答数: 'Số câu trả lời',
  総合: 'Tổng hợp',
  前月差: 'So với tháng trước',
  再来店意欲: 'Ý định quay lại',
  接客: 'Phục vụ',
  料理: 'Món ăn',
  提供速度: 'Tốc độ ra món',
  清潔感: 'Vệ sinh',
  配信数: 'Số lượt gửi',
  開封数: 'Số lượt mở',
  開封率: 'Tỷ lệ mở',
  来店客数: 'Số khách đến',
  来店率: 'Tỷ lệ đến cửa hàng',
  来店組数: 'Số nhóm khách',
  配信効果売上: 'Doanh thu từ tin nhắn',
  利用数: 'Số lượt sử dụng',
  来店組客数: 'Số nhóm khách đến',
  クーポン効果売上: 'Doanh thu từ phiếu giảm giá',
  組単価: 'Chi tiêu mỗi nhóm',
  利用率: 'Tỷ lệ sử dụng',
  配信管理名: 'Tên quản lý chiến dịch',
  クーポン名: 'Tên phiếu giảm giá',
  発生日時: 'Thời điểm phát sinh',
  実行者: 'Người thực hiện',
  操作: 'Thao tác',
  対象: 'Đối tượng',
  'IP アドレス': 'Địa chỉ IP',
  振込申請日: 'Ngày yêu cầu chuyển khoản',
  振込実行日: 'Ngày chuyển khoản',
  入金ステータス: 'Trạng thái chuyển khoản',
  口座: 'Tài khoản ngân hàng',
  起算日: 'Ngày bắt đầu',
  締め日: 'Ngày chốt',
  入金額: 'Số tiền nhận',
  手数料: 'Phí',
  消費税: 'Thuế tiêu thụ',
  調整額: 'Khoản điều chỉnh',
  繰越: 'Chuyển tiếp',
  入金サイクル: 'Chu kỳ chuyển khoản',
  入金明細書: 'Bảng kê chuyển khoản',
  商品名: 'Tên món',
  注文数: 'Số lượt gọi',
  平均調理時間: 'Thời gian chế biến TB',
  平均受け渡し時間: 'Thời gian bàn giao TB',
  平均配膳時間: 'Thời gian phục vụ TB',
  年代: 'Độ tuổi',
  構成比: 'Tỷ trọng',
  男性: 'Nam',
  女性: 'Nữ',
  その他: 'Khác',
  回答しない: 'Không trả lời',
  項目: 'Hạng mục',
  レポート名: 'Tên báo cáo',
  区分: 'Phân loại',
  指標: 'Chỉ số',
  共有範囲: 'Phạm vi chia sẻ',
  作成者: 'Người tạo',
  最終更新: 'Cập nhật cuối',

  // --- ボタン・状態 ---
  実行: 'Chạy',
  実行する: 'Chạy',
  破棄する: 'Hủy bỏ',
  送信: 'Gửi',
  設問を追加: 'Thêm câu hỏi',
  すべて展開: 'Mở tất cả',
  すべて折りたたむ: 'Thu gọn tất cả',
  ダウンロード: 'Tải xuống',
  新規レポート: 'Báo cáo mới',
  返金申請: 'Yêu cầu hoàn tiền',
  対象者数を更新: 'Cập nhật số đối tượng',
  下書き保存: 'Lưu nháp',
  配信を予約: 'Đặt lịch gửi',
  送ってみる: 'Gửi thử',
  停止: 'Dừng',
  再開: 'Tiếp tục',
  やめる: 'Hủy',
  すべての実行者: 'Tất cả người thực hiện',
  すべての操作: 'Tất cả thao tác',
  全店舗: 'Tất cả cửa hàng',
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
