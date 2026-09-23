/**
 * モバイルオーダーの表示言語。
 *
 * ベトナムからのお客様・在住のお客様向けにベトナム語を足している。
 * メニュー名などは `*_translations` の訳を使い、訳が無ければ日本語のまま出す。
 */

export const GUEST_LOCALES = [
  { value: 'ja', label: '日本語' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'en', label: 'English' },
] as const;

export type GuestLocale = (typeof GUEST_LOCALES)[number]['value'];

export const GUEST_LOCALE_PARAM = 'lang';

export function isGuestLocale(value: string | undefined | null): value is GuestLocale {
  return value === 'ja' || value === 'vi' || value === 'en';
}

/** 画面の固定文言。訳が無ければ日本語 */
const STRINGS: Record<Exclude<GuestLocale, 'ja'>, Record<string, string>> = {
  vi: {
    // --- 未訳だったぶん（お客様の画面は全部訳す） ---
    'ただいまモバイルからのご注文を停止しています。店員にお声がけください。':
      'Hiện không nhận gọi món qua điện thoại. Vui lòng gọi nhân viên.',
    'お会計を承りました。店員がお伺いします。':
      'Đã nhận yêu cầu thanh toán. Nhân viên sẽ đến bàn của bạn.',
    'エラーが発生しました。': 'Đã xảy ra lỗi.',
    '（内 消費税）': '(gồm thuế)',
    'お会計はレジまたは店員がお席でご案内します。':
      'Thanh toán tại quầy hoặc nhân viên sẽ hướng dẫn tại bàn.',
    '注文できませんでした。': 'Không thể gọi món.',
    '確定後のキャンセルは店員にお申し付けください':
      'Sau khi xác nhận, vui lòng gọi nhân viên nếu muốn hủy',
    まもなく提供: 'Sắp phục vụ',
    '送信中…': 'Đang gửi…',
    注文を確定する: 'Xác nhận gọi món',
    未調理: 'Chờ chế biến',
    調理中: 'Đang chế biến',
    提供待ち: 'Chờ phục vụ',
    提供済み: 'Đã phục vụ',
    キャンセル: 'Đã hủy',
    必須: 'Bắt buộc',
    任意: 'Tùy chọn',
    選択: 'đã chọn',
    備考: 'Ghi chú',
    '例：わさび抜き': 'VD: không wasabi',
    カートに追加: 'Thêm vào giỏ',
    必須の選択があります: 'Vui lòng chọn mục bắt buộc',
    数量を減らす: 'Giảm số lượng',
    数量を増やす: 'Tăng số lượng',
    本日売切: 'Hết hàng hôm nay',
    をカートに追加しました: ' đã thêm vào giỏ',
    準備中です: 'Đang chuẩn bị',
    まだご注文はありません: 'Chưa có món nào được gọi',
    小計: 'Tạm tính',
    サービス料: 'Phí dịch vụ',
    カートは空です: 'Giỏ hàng trống',
    ありがとうございました: 'Cảm ơn quý khách',
    'またのご来店をお待ちしております。': 'Hẹn gặp lại quý khách.',
    'ご来店ありがとうございます。': 'Cảm ơn quý khách đã ghé thăm.',
    '人数を選んで注文をはじめてください。': 'Chọn số người để bắt đầu gọi món.',
    '準備中…': 'Đang xử lý…',
    名で注文をはじめる: ' người · Bắt đầu gọi món',
    人数の変更やご不明な点は店員にお申し付けください:
      'Nếu cần đổi số người hoặc có thắc mắc, vui lòng gọi nhân viên.',
    'エラーが発生しました。店員にお声がけください。':
      'Đã xảy ra lỗi. Vui lòng gọi nhân viên.',
    // --- Zalo 連携 ---
    'Zalo でつながる': 'Kết nối với Zalo',
    'お得な情報をお届けします': 'Nhận ưu đãi dành riêng cho bạn',
    'フォローすると特典がもらえます': 'Theo dõi để nhận ưu đãi',
    'キャンペーンやクーポンの案内を受け取る': 'Tôi đồng ý nhận thông tin khuyến mãi và phiếu giảm giá',
    'いつでも受信を止められます': 'Bạn có thể hủy nhận bất cứ lúc nào',
    'あとで': 'Để sau',
    'このまま注文する': 'Tiếp tục đặt món',
    'ご来店ありがとうございます': 'Cảm ơn bạn đã ghé thăm',
    '会員ランク': 'Hạng thành viên',
    'ご来店': 'Số lần ghé thăm',
    '回目': ' lần',
    'Zalo と連携しました': 'Đã kết nối Zalo',
    '連携できませんでした。そのままご注文いただけます。':
      'Không thể kết nối. Bạn vẫn có thể đặt món.',
    'Zalo 連携はまだ準備中です。そのままご注文いただけます。':
      'Kết nối Zalo đang được chuẩn bị. Bạn vẫn có thể đặt món.',
    'Zalo 公式アカウントをフォロー': 'Theo dõi Zalo Official Account',
    '様': '',
    // 会員ランク
    レギュラー: 'Thường',
    シルバー: 'Bạc',
    ゴールド: 'Vàng',
    プラチナ: 'Bạch kim',
    メニュー: 'Thực đơn',
    注文履歴: 'Lịch sử gọi món',
    カート: 'Giỏ hàng',
    注文する: 'Gọi món',
    会計をお願いする: 'Yêu cầu thanh toán',
    合計: 'Tổng cộng',
    消費税: 'Thuế',
    売り切れ: 'Hết hàng',
    点: 'món',
    円: 'đ',
    注文を受け付けました: 'Đã nhận yêu cầu gọi món',
    'ご注文はキッチンへ送られました。': 'Yêu cầu đã được gửi tới bếp.',
    'ただいま注文を受け付けていません。': 'Hiện không nhận gọi món.',
    'スタッフがお伺いします。': 'Nhân viên sẽ tới bàn của bạn.',
    数量: 'Số lượng',
    閉じる: 'Đóng',
    戻る: 'Quay lại',
    言語: 'Ngôn ngữ',
    卓: 'Bàn',
    ご注文ありがとうございます: 'Cảm ơn quý khách',
    まだ注文がありません: 'Chưa có món nào được gọi',
  },
  en: {
    // --- 未訳だったぶん（お客様の画面は全部訳す） ---
    'ただいまモバイルからのご注文を停止しています。店員にお声がけください。':
      'Mobile ordering is paused. Please ask a staff member.',
    'お会計を承りました。店員がお伺いします。':
      'We have your request. A staff member will come to your table.',
    'エラーが発生しました。': 'Something went wrong.',
    '（内 消費税）': '(incl. tax)',
    'お会計はレジまたは店員がお席でご案内します。':
      'Pay at the counter, or a staff member will assist you at your table.',
    '注文できませんでした。': 'We could not place your order.',
    '確定後のキャンセルは店員にお申し付けください':
      'To cancel after confirming, please ask a staff member',
    まもなく提供: 'Coming soon',
    '送信中…': 'Sending…',
    注文を確定する: 'Place order',
    未調理: 'Waiting',
    調理中: 'Cooking',
    提供待ち: 'Ready',
    提供済み: 'Served',
    キャンセル: 'Cancelled',
    必須: 'Required',
    任意: 'Optional',
    選択: 'selected',
    備考: 'Note',
    '例：わさび抜き': 'e.g. no wasabi',
    カートに追加: 'Add to cart',
    必須の選択があります: 'Please choose the required options',
    数量を減らす: 'Decrease quantity',
    数量を増やす: 'Increase quantity',
    本日売切: 'Sold out today',
    をカートに追加しました: ' added to cart',
    準備中です: 'Coming soon',
    まだご注文はありません: 'No orders yet',
    小計: 'Subtotal',
    サービス料: 'Service charge',
    カートは空です: 'Your cart is empty',
    ありがとうございました: 'Thank you',
    'またのご来店をお待ちしております。': 'We hope to see you again.',
    'ご来店ありがとうございます。': 'Welcome.',
    '人数を選んで注文をはじめてください。': 'Choose the number of guests to start ordering.',
    '準備中…': 'Please wait…',
    名で注文をはじめる: ' guests · Start ordering',
    人数の変更やご不明な点は店員にお申し付けください:
      'Please ask a staff member to change the number of guests or if you have any questions.',
    'エラーが発生しました。店員にお声がけください。':
      'Something went wrong. Please ask a staff member.',
    // --- Zalo 連携 ---
    'Zalo でつながる': 'Connect with Zalo',
    'お得な情報をお届けします': 'Get offers made for you',
    'フォローすると特典がもらえます': 'Follow us for a reward',
    'キャンペーンやクーポンの案内を受け取る': 'Send me offers and coupons',
    'いつでも受信を止められます': 'You can unsubscribe at any time',
    'あとで': 'Later',
    'このまま注文する': 'Continue to order',
    'ご来店ありがとうございます': 'Thanks for visiting',
    '会員ランク': 'Membership',
    'ご来店': 'Visits',
    '回目': '',
    'Zalo と連携しました': 'Connected to Zalo',
    '連携できませんでした。そのままご注文いただけます。':
      'We could not connect. You can still order.',
    'Zalo 連携はまだ準備中です。そのままご注文いただけます。':
      'Zalo connect is not set up yet. You can still order.',
    'Zalo 公式アカウントをフォロー': 'Follow our Zalo Official Account',
    '様': '',
    // 会員ランク
    レギュラー: 'Regular',
    シルバー: 'Silver',
    ゴールド: 'Gold',
    プラチナ: 'Platinum',
    メニュー: 'Menu',
    注文履歴: 'Order history',
    カート: 'Cart',
    注文する: 'Place order',
    会計をお願いする: 'Request the bill',
    合計: 'Total',
    消費税: 'Tax',
    売り切れ: 'Sold out',
    点: 'items',
    円: 'JPY',
    注文を受け付けました: 'Your order has been received',
    'ご注文はキッチンへ送られました。': 'Your order was sent to the kitchen.',
    'ただいま注文を受け付けていません。': 'Orders are not being accepted right now.',
    'スタッフがお伺いします。': 'A staff member will come to your table.',
    数量: 'Quantity',
    閉じる: 'Close',
    戻る: 'Back',
    言語: 'Language',
    卓: 'Table',
    ご注文ありがとうございます: 'Thank you for your order',
    まだ注文がありません: 'No orders yet',
  },
};

export function makeGuestTranslator(locale: GuestLocale) {
  return (text: string) => {
    if (locale === 'ja') return text;
    return STRINGS[locale][text] ?? text;
  };
}
