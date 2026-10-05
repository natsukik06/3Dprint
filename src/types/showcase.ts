// 作成例ギャラリー(Firestore: showcase_items)。サーバー(Admin SDK)だけが読み書きする。
// お客様の氏名・住所・メールなどの個人情報は一切持たない(orderId は管理画面での重複防止用で、公開側には出さない)。
export type ShowcaseItemPublic = {
  id: string;
  title: string;
  caption: string;
  modelUrl: string;
  customerImageUrl: string | null;
  photoUrl: string | null;
  showOnHome: boolean;
};

export type ShowcaseItemAdmin = ShowcaseItemPublic & {
  orderId: string;
  orderNumber: string | null;
  itemIndex: number;
  published: boolean;
  order: number;
  createdAtMs: number | null;
  publishedAtMs: number | null;
};

// 「作成例に追加」できる候補(掲載の許可あり・支払い済みの注文の1点ごと)
export type ShowcaseCandidate = {
  orderId: string;
  orderNumber: string | null;
  itemIndex: number;
  previewUrl: string | null;
  hasCustomerImage: boolean;
  added: boolean;
};

export const SHOWCASE_TITLE_MAX = 40;
export const SHOWCASE_CAPTION_MAX = 120;
export const HOME_SHOWCASE_LIMIT = 3;
