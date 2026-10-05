import { Zen_Old_Mincho, Zen_Kaku_Gothic_New } from "next/font/google";

const zenMincho = Zen_Old_Mincho({
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  variable: "--font-zen-mincho",
});

const zenGothic = Zen_Kaku_Gothic_New({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-zen-gothic",
});

const CONTACT_EMAIL = "natsuki.ko006@gmail.com";

// Static marketing landing page for shops / brand owners commissioning custom resin
// trays & plates, aimed at Instagram DM / email outreach -- not part of the main
// consumer shop, so it deliberately doesn't share the homepage's header/nav.
export default function PlateOemPage() {
  return (
    <div className={`${zenGothic.variable} ${zenMincho.variable} lp-plate`}>
      <style>{`
        .lp-plate{
          --cream:#f4ecdc;
          --cream-soft:#f3ece0;
          --card:#ffffff;
          --ink:#3f3424;
          --brown:#6b5c40;
          --brown-deep:#8a5a34;
          --teal:#0f766e;
          --teal-soft:#7fd8cb;
          --gold:#a9813f;
          --gold-soft:#e8d3a4;
          --line:#e3d7bd;
          --danger:#a3432f;
          background:var(--cream);
          color:var(--ink);
          font-family:var(--font-zen-gothic), sans-serif;
          line-height:1.85;
        }
        @media (prefers-color-scheme: dark){
          .lp-plate{
            --cream:#141210; --cream-soft:#1b1815; --card:#211d18;
            --ink:#f1e9db; --brown:#cdbb9c; --brown-deep:#e3ba7e;
            --teal:#7fd8cb; --teal-soft:#0f766e; --gold:#e3ba7e; --gold-soft:#4a3c22;
            --line:#3a3226; --danger:#e08a72;
          }
        }
        .lp-plate *{box-sizing:border-box;}
        .lp-plate .display{font-family:var(--font-zen-mincho), serif;}
        .lp-plate h1,.lp-plate h2,.lp-plate h3{text-wrap:balance; margin:0;}
        .lp-plate a{color:inherit;}
        .lp-plate .wrap{max-width:1080px; margin:0 auto; padding:0 24px;}
        .lp-plate .eyebrow{font-size:12px; letter-spacing:.18em; text-transform:uppercase; color:var(--gold); font-weight:700;}
        .lp-plate .hero{position:relative; padding:92px 0 76px; overflow:hidden;
          background:radial-gradient(ellipse 900px 500px at 82% -10%, color-mix(in srgb, var(--teal-soft) 30%, transparent), transparent 60%), var(--cream);}
        .lp-plate .hero-grid{display:grid; grid-template-columns:1.1fr .9fr; gap:56px; align-items:center;}
        .lp-plate .hero h1{font-size:clamp(30px,4vw,46px); font-weight:700; margin:14px 0 20px; color:var(--brown-deep);}
        .lp-plate .hero p.lead{font-size:16.5px; color:var(--brown); max-width:48ch;}
        .lp-plate .hero-cta{margin-top:32px; display:flex; gap:14px; flex-wrap:wrap; align-items:center;}
        .lp-plate .btn{display:inline-flex; align-items:center; gap:8px; padding:14px 28px; border-radius:999px; font-weight:700; font-size:14.5px; text-decoration:none; border:1px solid transparent; transition:transform .15s ease;}
        .lp-plate .btn:hover{transform:translateY(-1px);}
        .lp-plate .btn-primary{background:var(--teal); color:var(--cream-soft); box-shadow:0 10px 24px -10px color-mix(in srgb, var(--teal) 70%, transparent);}
        .lp-plate .btn-ghost{border-color:var(--brown-deep); color:var(--brown-deep);}
        .lp-plate .hero-note{margin-top:14px; font-size:12.5px; color:var(--brown); opacity:.85;}
        .lp-plate .art{position:relative; aspect-ratio:1/1; display:flex; align-items:center; justify-content:center;}
        .lp-plate .spark{position:absolute; border-radius:50%; background:radial-gradient(circle, var(--gold-soft), transparent 70%); filter:blur(1px);}
        .lp-plate section{padding:72px 0;}
        .lp-plate section + section{border-top:1px solid var(--line);}
        .lp-plate .section-head{max-width:640px; margin:0 auto 44px; text-align:center;}
        .lp-plate .section-head h2{font-size:clamp(24px,3vw,32px); color:var(--brown-deep); margin-top:10px;}
        .lp-plate .section-head p{color:var(--brown); font-size:15px; margin-top:12px;}
        .lp-plate .pains{display:grid; grid-template-columns:repeat(3,1fr); gap:20px;}
        .lp-plate .pain-card{background:var(--card); border:1px solid var(--line); border-radius:18px; padding:28px 24px;}
        .lp-plate .pain-card .num{font-family:var(--font-zen-mincho), serif; font-size:13px; color:var(--gold); font-weight:700;}
        .lp-plate .pain-card h3{font-size:17px; margin:10px 0 8px; color:var(--ink);}
        .lp-plate .pain-card p{font-size:14px; color:var(--brown); margin:0;}
        .lp-plate .process{display:grid; grid-template-columns:repeat(4,1fr); gap:0;}
        .lp-plate .step{padding:0 18px;}
        .lp-plate .step-num{width:54px; height:54px; border-radius:50%; background:var(--cream-soft); border:1px solid var(--line); display:flex; align-items:center; justify-content:center; font-family:var(--font-zen-mincho), serif; font-weight:700; font-size:18px; color:var(--teal); margin-bottom:16px;}
        .lp-plate .step h3{font-size:15.5px; margin-bottom:8px; color:var(--ink);}
        .lp-plate .step p{font-size:13.5px; color:var(--brown); margin:0;}
        .lp-plate .offer{background:linear-gradient(135deg, var(--brown-deep), var(--gold)); border-radius:24px; padding:48px 44px; color:#fff5e6; display:grid; grid-template-columns:1.3fr .7fr; gap:36px; align-items:center;}
        .lp-plate .offer .eyebrow{color:#fff5e6; opacity:.85;}
        .lp-plate .offer h2{font-size:clamp(22px,2.8vw,28px); margin:12px 0 14px; color:#fff;}
        .lp-plate .offer p{font-size:14.5px; opacity:.92; margin:0 0 6px;}
        .lp-plate .offer-box{background:rgba(255,255,255,.12); border:1px solid rgba(255,255,255,.35); border-radius:16px; padding:22px;}
        .lp-plate .offer-box .big{font-family:var(--font-zen-mincho), serif; font-size:34px; font-weight:700;}
        .lp-plate .offer-box .small{font-size:12.5px; opacity:.85; margin-top:6px;}
        .lp-plate .use-grid{display:grid; grid-template-columns:repeat(4,1fr); gap:18px;}
        .lp-plate .use-card{border:1px solid var(--line); border-radius:16px; padding:22px; background:var(--card); text-align:center;}
        .lp-plate .use-card .icon{font-size:26px; margin-bottom:10px;}
        .lp-plate .use-card h3{font-size:14.5px; margin-bottom:6px;}
        .lp-plate .use-card p{font-size:12.5px; color:var(--brown); margin:0;}
        .lp-plate .mat-grid{display:grid; grid-template-columns:1fr 1fr; gap:44px; align-items:start;}
        .lp-plate .mat-copy p{color:var(--brown); font-size:14.5px;}
        .lp-plate .shapes{display:grid; grid-template-columns:repeat(3,1fr); gap:16px;}
        .lp-plate .shape-card{border:1px solid var(--line); border-radius:16px; padding:18px; background:var(--card); text-align:center;}
        .lp-plate .shape-card svg{width:70%; height:auto; margin:0 auto 10px;}
        .lp-plate .shape-card span{font-size:12px; color:var(--brown); font-weight:500;}
        .lp-plate table{width:100%; border-collapse:collapse; font-size:14px;}
        .lp-plate th,.lp-plate td{padding:16px 14px; text-align:left; border-bottom:1px solid var(--line);}
        .lp-plate th{color:var(--brown); font-weight:500; font-size:12.5px; letter-spacing:.04em;}
        .lp-plate td.hilite{color:var(--teal); font-weight:700;}
        .lp-plate tr:last-child td{border-bottom:none;}
        .lp-plate .trust{display:grid; grid-template-columns:repeat(3,1fr); gap:20px;}
        .lp-plate .trust-card{border:1px solid var(--line); border-radius:16px; padding:24px; background:var(--card);}
        .lp-plate .trust-card .icon{width:40px; height:40px; border-radius:10px; background:var(--cream-soft); display:flex; align-items:center; justify-content:center; margin-bottom:14px;}
        .lp-plate .trust-card h3{font-size:15.5px; margin-bottom:8px;}
        .lp-plate .trust-card p{font-size:13.5px; color:var(--brown); margin:0;}
        .lp-plate .compliance-note{margin-top:24px; border-left:3px solid var(--danger); padding:14px 18px; background:color-mix(in srgb, var(--danger) 8%, var(--card)); font-size:13.5px; color:var(--brown); border-radius:0 10px 10px 0;}
        .lp-plate .compliance-note b{color:var(--danger);}
        .lp-plate .final{text-align:center; padding:80px 0 96px;}
        .lp-plate .final h2{font-size:clamp(24px,3.4vw,34px); color:var(--brown-deep); margin-bottom:16px;}
        .lp-plate .final p{color:var(--brown); max-width:44ch; margin:0 auto 30px; font-size:15px;}
        .lp-plate footer{padding:28px 0; text-align:center; font-size:12px; color:var(--brown); opacity:.7;}
        @media (max-width: 860px){
          .lp-plate .hero-grid{grid-template-columns:1fr;}
          .lp-plate .art{order:-1; max-width:260px; margin:0 auto;}
          .lp-plate .pains{grid-template-columns:1fr;}
          .lp-plate .process{grid-template-columns:1fr 1fr; row-gap:28px;}
          .lp-plate .offer{grid-template-columns:1fr;}
          .lp-plate .use-grid{grid-template-columns:repeat(2,1fr);}
          .lp-plate .mat-grid{grid-template-columns:1fr;}
          .lp-plate .shapes{grid-template-columns:repeat(2,1fr);}
          .lp-plate .trust{grid-template-columns:1fr;}
          .lp-plate table{font-size:12.5px;}
        }
      `}</style>

      <div className="hero">
        <div className="wrap hero-grid">
          <div>
            <p className="eyebrow">Charo 3D &nbsp;|&nbsp; ORIGINAL TRAY &amp; PLATE OEM</p>
            <h1 className="display">
              かたちのアイデアを、
              <br />
              設計から自社商品に。
            </h1>
            <p className="lead">
              欲しい形のイメージ画像を送るだけ。1点ずつ手作業でCAD設計し、3Dプリントで試作品をお届けします。すでに3Dデータをお持ちの場合は、印刷のみのご依頼も可能です。気に入ったら50個から量産——金型代も在庫リスクもかかりません。
            </p>
            <div className="hero-cta">
              <a className="btn btn-primary" href="#offer">
                まずは相談する →
              </a>
              <a className="btn btn-ghost" href="#process">
                仕組みを見る
              </a>
            </div>
            <p className="hero-note">対象：雑貨店・ギフトショップ・ブランドオーナー・作家様（法人・個人事業主）</p>
          </div>
          <div className="art">
            <svg viewBox="0 0 220 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "78%" }}>
              <defs>
                <linearGradient id="plateGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--cream-soft)" />
                  <stop offset="100%" stopColor="var(--gold-soft)" />
                </linearGradient>
              </defs>
              <ellipse cx="110" cy="150" rx="90" ry="18" fill="var(--brown-deep)" opacity="0.12" />
              <ellipse cx="110" cy="110" rx="95" ry="55" fill="url(#plateGrad)" stroke="var(--brown-deep)" strokeWidth="2" />
              <ellipse cx="110" cy="106" rx="62" ry="34" fill="var(--cream)" stroke="var(--brown-deep)" strokeWidth="1.4" opacity="0.9" />
              <path d="M60 90 C 90 70 130 70 160 90" fill="none" stroke="var(--teal)" strokeWidth="2.5" opacity="0.7" />
              <circle cx="150" cy="70" r="6" fill="var(--gold)" />
            </svg>
            <div className="spark" style={{ width: 60, height: 60, top: "8%", right: "8%" }} />
            <div className="spark" style={{ width: 36, height: 36, bottom: "20%", left: "6%" }} />
          </div>
        </div>
      </div>

      <section>
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Problem</p>
            <h2 className="display">オリジナル雑貨を作るときの、3つの壁</h2>
          </div>
          <div className="pains">
            <div className="pain-card">
              <p className="num">01</p>
              <h3>金型代が高すぎる</h3>
              <p>陶器や樹脂皿を新しい形で作ろうとすると、金型代だけで数十万円。小さく試すことができない。</p>
            </div>
            <div className="pain-card">
              <p className="num">02</p>
              <h3>大ロットしか受けてもらえない</h3>
              <p>既存のOEM工場は数百〜数千個単位が最低ロット。売れるかわからない新商品には手が出せない。</p>
            </div>
            <div className="pain-card">
              <p className="num">03</p>
              <h3>サンプル確認に時間がかかる</h3>
              <p>試作のやり取りだけで数ヶ月。デザインの微調整のたびに追加コストが発生することも。</p>
            </div>
          </div>
        </div>
      </section>

      <section id="process">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Two Ways to Order</p>
            <h2 className="display">ご依頼は、2つの形からお選びいただけます</h2>
            <p>デザインから頼みたい方も、データはあるので印刷だけ頼みたい方も。</p>
          </div>
          <div className="use-grid" style={{ gridTemplateColumns: "repeat(2,1fr)", marginBottom: 56 }}>
            <div className="use-card" style={{ textAlign: "left", padding: 28 }}>
              <div className="icon">✏️</div>
              <h3 style={{ fontSize: 16 }}>設計から丸ごと依頼</h3>
              <p style={{ fontSize: 13 }}>イメージ画像や寸法のご希望をお送りいただければ、1点ずつ手作業でCAD設計し、3Dプリントで試作品を製作・発送します。図面や3Dデータをお持ちでない方はこちら。</p>
            </div>
            <div className="use-card" style={{ textAlign: "left", padding: 28 }}>
              <div className="icon">🖨️</div>
              <h3 style={{ fontSize: 16 }}>印刷のみ依頼</h3>
              <p style={{ fontSize: 13 }}>STL等の3Dモデルデータをすでにお持ちの場合は、設計工程を省いて印刷のみ承ります。ご自身やデザイナーが用意したデータを、そのまま実物化できます。</p>
            </div>
          </div>
          <div className="section-head">
            <p className="eyebrow">How it works</p>
            <h2 className="display">ご相談から量産まで、4ステップ</h2>
          </div>
          <div className="process">
            <div className="step">
              <div className="step-num">01</div>
              <h3>画像・データを送る</h3>
              <p>参考にしたい形の画像やラフ、またはお手持ちの3Dデータを1点。用途やサイズのご希望も合わせてお聞かせください。</p>
            </div>
            <div className="step">
              <div className="step-num">02</div>
              <h3>CADで設計 / データ確認</h3>
              <p>設計から依頼の場合は私が直接CADでモデリング。データ支給の場合は印刷可否を確認し、調整します。</p>
            </div>
            <div className="step">
              <div className="step-num">03</div>
              <h3>試作品を発送</h3>
              <p>黄変しないクリアレジンで実物を造形。手に取って質感・サイズ感をご確認いただけます。</p>
            </div>
            <div className="step">
              <div className="step-num">04</div>
              <h3>50個から量産発注</h3>
              <p>気に入ったら本発注。金型不要・在庫リスクゼロで、自社ブランド品として展開できます。</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="offer" id="offer">
            <div>
              <p className="eyebrow">まずはご相談</p>
              <h2 className="display">お見積もりとラフ設計案は無料です。</h2>
              <p>画像や寸法のご要望をお送りいただければ、設計にかかる工数と試作費用を無料でお見積もりします。実際に発注いただくまで費用は発生しません。</p>
              <p>気に入らなければ、それで構いません。無理な営業は一切いたしません。</p>
            </div>
            <div className="offer-box">
              <div className="big">お見積もり / 無料</div>
              <div className="small">設計・試作の費用感をご提示。ご発注は任意です</div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Use Cases</p>
            <h2 className="display">こんな用途でご利用いただいています</h2>
          </div>
          <div className="use-grid">
            <div className="use-card">
              <div className="icon">🍽️</div>
              <h3>カフェ・雑貨店</h3>
              <p>店舗オリジナルの豆皿・トレイ</p>
            </div>
            <div className="use-card">
              <div className="icon">💍</div>
              <h3>アクセサリー作家</h3>
              <p>ブランド用アクセサリートレイ</p>
            </div>
            <div className="use-card">
              <div className="icon">🎁</div>
              <h3>ギフトショップ</h3>
              <p>記念品・ノベルティの小皿</p>
            </div>
            <div className="use-card">
              <div className="icon">🏺</div>
              <h3>陶芸・樹脂作家</h3>
              <p>量産前のデザイン検証モデル</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Material &amp; Shape</p>
            <h2 className="display">素材とかたちは、自由に。</h2>
          </div>
          <div className="mat-grid">
            <div className="mat-copy">
              <p>ベースには耐黄変性の高い高透明クリアレジンを採用。着色剤を調合することで、ブランドカラーに合わせた色展開も可能です。</p>
              <p>丸皿・変形皿・トレイ・コースターなど、かたちの制約はほとんどありません。ロゴや刻印を面に入れることもできます。</p>
            </div>
            <div className="shapes">
              <div className="shape-card">
                <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="var(--cream-soft)" stroke="var(--brown-deep)" strokeWidth="2" /></svg>
                <span>丸皿</span>
              </div>
              <div className="shape-card">
                <svg viewBox="0 0 100 100"><path d="M50 8 C 85 8 92 45 78 65 C 65 85 35 85 22 65 C 8 45 15 8 50 8 Z" fill="var(--cream-soft)" stroke="var(--brown-deep)" strokeWidth="2" /></svg>
                <span>変形皿</span>
              </div>
              <div className="shape-card">
                <svg viewBox="0 0 100 100"><rect x="10" y="30" width="80" height="40" rx="14" fill="var(--cream-soft)" stroke="var(--brown-deep)" strokeWidth="2" /></svg>
                <span>トレイ</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Lot &amp; Price</p>
            <h2 className="display">小ロット対応の量産プラン</h2>
          </div>
          <table>
            <thead>
              <tr><th>プラン</th><th>数量</th><th>目安納期</th><th>備考</th></tr>
            </thead>
            <tbody>
              <tr><td>お見積もり・ラフ設計案</td><td>-</td><td>2〜4日</td><td className="hilite">無料</td></tr>
              <tr><td>設計＋試作（丸ごと依頼）</td><td>1点</td><td>10〜14日</td><td>CAD設計費＋プリント実費</td></tr>
              <tr><td>印刷のみ（データ支給）</td><td>1点〜</td><td>3〜7日</td><td>設計費なし・プリント実費のみ</td></tr>
              <tr><td>スモールロット量産</td><td>50個〜</td><td>3〜4週間</td><td>金型代なし・デザイン微調整1回まで無料</td></tr>
              <tr><td>定番化ロット</td><td>100個〜</td><td>4〜6週間</td><td>数量に応じて単価が下がります</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Trust</p>
            <h2 className="display">安心してご依頼いただくために</h2>
          </div>
          <div className="trust">
            <div className="trust-card">
              <div className="icon">🧪</div>
              <h3>食品には使用しない前提</h3>
              <p>本製品は雑貨・ディスプレイ用途です。食品を直接盛り付ける食器としての使用は想定しておらず、その旨を明記した上で納品します。</p>
            </div>
            <div className="trust-card">
              <div className="icon">🧤</div>
              <h3>安全な製造環境</h3>
              <p>ニトリル手袋・防毒マスク・強制換気のもとで製造。素材の安全データも共有可能です。</p>
            </div>
            <div className="trust-card">
              <div className="icon">📐</div>
              <h3>データ・レシピ管理</h3>
              <p>承認いただいた試作品の3Dデータと配合レシピを保管。量産時・再発注時も同じ品質を再現します。</p>
            </div>
          </div>
          <div className="compliance-note">
            <b>お受けできないご依頼について：</b> 既存キャラクターや著名ブランドロゴ等、第三者の知的財産権を含むデザインのご依頼はお断りしております。完全オリジナルデザインのみ対応いたします。
          </div>
        </div>
      </section>

      <div className="final">
        <div className="wrap">
          <p className="eyebrow">Contact</p>
          <h2 className="display">まずは、作りたい形の画像を1枚送ってください。</h2>
          <p>お見積もり・ご相談は無料です。メールよりお気軽にどうぞ。</p>
          <div className="hero-cta" style={{ justifyContent: "center" }}>
            <a className="btn btn-primary" href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("お皿・トレイOEMのご相談")}`}>
              メールで相談する
            </a>
          </div>
        </div>
      </div>

      <footer>Charo 3D — Original Tray &amp; Plate OEM</footer>
    </div>
  );
}
