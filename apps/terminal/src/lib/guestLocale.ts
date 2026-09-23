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
    カートに追加: 'Thêm vào giỏ',
    注文する: 'Gọi món',
    会計をお願いする: 'Yêu cầu thanh toán',
    合計: 'Tổng cộng',
    小計: 'Tạm tính',
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
    カートに追加: 'Add to cart',
    注文する: 'Place order',
    会計をお願いする: 'Request the bill',
    合計: 'Total',
    小計: 'Subtotal',
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
