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
const INSTAGRAM_URL = "https://instagram.com/lumina_charo";

// Static marketing landing page for nail salons / nail artists, aimed at Instagram DM /
// email outreach -- not part of the main consumer shop, so it deliberately doesn't
// share the homepage's header/nav.
export default function NailOemPage() {
  return (
    <div className={`${zenGothic.variable} ${zenMincho.variable} lp-nail`}>
      <style>{`
        .lp-nail{
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
          .lp-nail{
            --cream:#141210; --cream-soft:#1b1815; --card:#211d18;
            --ink:#f1e9db; --brown:#cdbb9c; --brown-deep:#e3ba7e;
            --teal:#7fd8cb; --teal-soft:#0f766e; --gold:#e3ba7e; --gold-soft:#4a3c22;
            --line:#3a3226; --danger:#e08a72;
          }
        }
        .lp-nail *{box-sizing:border-box;}
        .lp-nail .display{font-family:var(--font-zen-mincho), serif;}
        .lp-nail h1,.lp-nail h2,.lp-nail h3{text-wrap:balance; margin:0;}
        .lp-nail a{color:inherit;}
        .lp-nail .wrap{max-width:1080px; margin:0 auto; padding:0 24px;}
        .lp-nail .eyebrow{font-size:12px; letter-spacing:.18em; text-transform:uppercase; color:var(--gold); font-weight:700;}
        .lp-nail .hero{position:relative; padding:92px 0 76px; overflow:hidden;
          background:radial-gradient(ellipse 900px 500px at 82% -10%, color-mix(in srgb, var(--teal-soft) 30%, transparent), transparent 60%), var(--cream);}
        .lp-nail .hero-grid{display:grid; grid-template-columns:1.1fr .9fr; gap:56px; align-items:center;}
        .lp-nail .hero h1{font-size:clamp(30px,4.2vw,48px); font-weight:700; margin:14px 0 20px; color:var(--brown-deep);}
        .lp-nail .hero p.lead{font-size:16.5px; color:var(--brown); max-width:46ch;}
        .lp-nail .hero-cta{margin-top:32px; display:flex; gap:14px; flex-wrap:wrap; align-items:center;}
        .lp-nail .btn{display:inline-flex; align-items:center; gap:8px; padding:14px 28px; border-radius:999px; font-weight:700; font-size:14.5px; text-decoration:none; border:1px solid transparent; transition:transform .15s ease;}
        .lp-nail .btn:hover{transform:translateY(-1px);}
        .lp-nail .btn-primary{background:var(--teal); color:var(--cream-soft); box-shadow:0 10px 24px -10px color-mix(in srgb, var(--teal) 70%, transparent);}
        .lp-nail .btn-ghost{border-color:var(--brown-deep); color:var(--brown-deep);}
        .lp-nail .hero-note{margin-top:14px; font-size:12.5px; color:var(--brown); opacity:.85;}
        .lp-nail .art{position:relative; aspect-ratio:1/1.05; display:flex; align-items:center; justify-content:center;}
        .lp-nail .tip{width:62%; filter:drop-shadow(0 22px 34px color-mix(in srgb, var(--brown-deep) 30%, transparent));}
        .lp-nail .spark{position:absolute; border-radius:50%; background:radial-gradient(circle, var(--gold-soft), transparent 70%); filter:blur(1px);}
        .lp-nail section{padding:72px 0;}
        .lp-nail section + section{border-top:1px solid var(--line);}
        .lp-nail .section-head{max-width:640px; margin:0 auto 44px; text-align:center;}
        .lp-nail .section-head h2{font-size:clamp(24px,3vw,32px); color:var(--brown-deep); margin-top:10px;}
        .lp-nail .section-head p{color:var(--brown); font-size:15px; margin-top:12px;}
        .lp-nail .pains{display:grid; grid-template-columns:repeat(3,1fr); gap:20px;}
        .lp-nail .pain-card{background:var(--card); border:1px solid var(--line); border-radius:18px; padding:28px 24px;}
        .lp-nail .pain-card .num{font-family:var(--font-zen-mincho), serif; font-size:13px; color:var(--gold); font-weight:700;}
        .lp-nail .pain-card h3{font-size:17px; margin:10px 0 8px; color:var(--ink);}
        .lp-nail .pain-card p{font-size:14px; color:var(--brown); margin:0;}
        .lp-nail .process{display:grid; grid-template-columns:repeat(4,1fr); gap:0;}
        .lp-nail .step{padding:0 18px;}
        .lp-nail .step-num{width:54px; height:54px; border-radius:50%; background:var(--cream-soft); border:1px solid var(--line); display:flex; align-items:center; justify-content:center; font-family:var(--font-zen-mincho), serif; font-weight:700; font-size:18px; color:var(--teal); margin-bottom:16px;}
        .lp-nail .step h3{font-size:15.5px; margin-bottom:8px; color:var(--ink);}
        .lp-nail .step p{font-size:13.5px; color:var(--brown); margin:0;}
        .lp-nail .offer{background:linear-gradient(135deg, var(--brown-deep), var(--gold)); border-radius:24px; padding:48px 44px; color:#fff5e6; display:grid; grid-template-columns:1.3fr .7fr; gap:36px; align-items:center;}
        .lp-nail .offer .eyebrow{color:#fff5e6; opacity:.85;}
        .lp-nail .offer h2{font-size:clamp(22px,2.8vw,28px); margin:12px 0 14px; color:#fff;}
        .lp-nail .offer p{font-size:14.5px; opacity:.92; margin:0 0 6px;}
        .lp-nail .offer-box{background:rgba(255,255,255,.12); border:1px solid rgba(255,255,255,.35); border-radius:16px; padding:22px;}
        .lp-nail .offer-box .big{font-family:var(--font-zen-mincho), serif; font-size:34px; font-weight:700;}
        .lp-nail .offer-box .small{font-size:12.5px; opacity:.85; margin-top:6px;}
        .lp-nail .mat-grid{display:grid; grid-template-columns:1fr 1fr; gap:44px; align-items:start;}
        .lp-nail .mat-copy p{color:var(--brown); font-size:14.5px;}
        .lp-nail .swatches{display:grid; grid-template-columns:repeat(6,1fr); gap:12px;}
        .lp-nail .swatch{aspect-ratio:1; border-radius:14px; border:1px solid var(--line); display:flex; align-items:flex-end; padding:8px; position:relative; overflow:hidden;}
        .lp-nail .swatch span{font-size:10.5px; color:#fff; text-shadow:0 1px 3px rgba(0,0,0,.5); font-weight:700;}
        .lp-nail .swatch::after{content:""; position:absolute; inset:0; background:radial-gradient(circle at 30% 20%, rgba(255,255,255,.55), transparent 45%);}
        .lp-nail table{width:100%; border-collapse:collapse; font-size:14px;}
        .lp-nail th,.lp-nail td{padding:16px 14px; text-align:left; border-bottom:1px solid var(--line);}
        .lp-nail th{color:var(--brown); font-weight:500; font-size:12.5px; letter-spacing:.04em;}
        .lp-nail td.hilite{color:var(--teal); font-weight:700;}
        .lp-nail tr:last-child td{border-bottom:none;}
        .lp-nail .trust{display:grid; grid-template-columns:repeat(3,1fr); gap:20px;}
        .lp-nail .trust-card{border:1px solid var(--line); border-radius:16px; padding:24px; background:var(--card);}
        .lp-nail .trust-card .icon{width:40px; height:40px; border-radius:10px; background:var(--cream-soft); display:flex; align-items:center; justify-content:center; margin-bottom:14px;}
        .lp-nail .trust-card h3{font-size:15.5px; margin-bottom:8px;}
        .lp-nail .trust-card p{font-size:13.5px; color:var(--brown); margin:0;}
        .lp-nail .compliance-note{margin-top:24px; border-left:3px solid var(--danger); padding:14px 18px; background:color-mix(in srgb, var(--danger) 8%, var(--card)); font-size:13.5px; color:var(--brown); border-radius:0 10px 10px 0;}
        .lp-nail .compliance-note b{color:var(--danger);}
        .lp-nail .final{text-align:center; padding:80px 0 96px;}
        .lp-nail .final h2{font-size:clamp(24px,3.4vw,34px); color:var(--brown-deep); margin-bottom:16px;}
        .lp-nail .final p{color:var(--brown); max-width:44ch; margin:0 auto 30px; font-size:15px;}
        .lp-nail footer{padding:28px 0; text-align:center; font-size:12px; color:var(--brown); opacity:.7;}
        @media (max-width: 860px){
          .lp-nail .hero-grid{grid-template-columns:1fr;}
          .lp-nail .art{order:-1; max-width:280px; margin:0 auto;}
          .lp-nail .pains{grid-template-columns:1fr;}
          .lp-nail .process{grid-template-columns:1fr 1fr; row-gap:28px;}
          .lp-nail .offer{grid-template-columns:1fr;}
          .lp-nail .mat-grid{grid-template-columns:1fr;}
          .lp-nail .swatches{grid-template-columns:repeat(4,1fr);}
          .lp-nail .trust{grid-template-columns:1fr;}
          .lp-nail table{font-size:12.5px;}
        }
      `}</style>

      <div className="hero">
        <div className="wrap hero-grid">
          <div>
            <p className="eyebrow">LUMINA CHARO &nbsp;|&nbsp; NAIL PARTS OEM</p>
            <h1 className="display">
              画像1枚から、
              <br />
              あなたのサロンだけのパーツを。
            </h1>
            <p className="lead">
              SNSで見つけたイメージ画像を送るだけ。AIが3Dモデルを起こし、試作品を送料のみでお作りします。気に入ったら50個から量産——型代も在庫リスクもありません。
            </p>
            <div className="hero-cta">
              <a className="btn btn-primary" href="#offer">
                試作品を無料で試す →
              </a>
              <a className="btn btn-ghost" href="#process">
                仕組みを見る
              </a>
            </div>
            <p className="hero-note">対象：ネイルサロン・ネイリスト・ネイルチップ作家様（法人・個人事業主）</p>
          </div>
          <div className="art">
            <svg className="tip" viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="tipGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--cream-soft)" />
                  <stop offset="100%" stopColor="var(--gold-soft)" />
                </linearGradient>
                <linearGradient id="gemGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="var(--teal-soft)" />
                  <stop offset="100%" stopColor="var(--teal)" />
                </linearGradient>
              </defs>
              <path
                d="M100 14 C 150 14 176 60 176 118 C 176 176 142 206 100 206 C 58 206 24 176 24 118 C 24 60 50 14 100 14 Z"
                fill="url(#tipGrad)"
                stroke="var(--brown-deep)"
                strokeWidth="2"
                opacity="0.9"
              />
              <ellipse cx="100" cy="108" rx="26" ry="20" fill="url(#gemGrad)" stroke="var(--brown-deep)" strokeWidth="1.5" />
              <circle cx="72" cy="150" r="8" fill="var(--gold)" />
              <circle cx="128" cy="150" r="8" fill="var(--gold)" />
              <circle cx="100" cy="168" r="6" fill="var(--teal-soft)" />
            </svg>
            <div className="spark" style={{ width: 70, height: 70, top: "6%", right: "4%" }} />
            <div className="spark" style={{ width: 40, height: 40, bottom: "18%", left: "2%" }} />
          </div>
        </div>
      </div>

      <section>
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Problem</p>
            <h2 className="display">サロンの現場が抱える、3つの壁</h2>
          </div>
          <div className="pains">
            <div className="pain-card">
              <p className="num">01</p>
              <h3>差別化できない</h3>
              <p>既製パーツは他店と被る。オリジナル商材をOEMで作ろうとすると、カラージェルで1kg、ファイルで2,000本といった最小ロットが壁になる。</p>
            </div>
            <div className="pain-card">
              <p className="num">02</p>
              <h3>在庫リスクが怖い</h3>
              <p>試しに大量発注して、使わない在庫が資金繰りを圧迫——という失敗は避けたい。少量で試してから定番化するのが鉄則。</p>
            </div>
            <div className="pain-card">
              <p className="num">03</p>
              <h3>手作りは時間がかかる</h3>
              <p>複雑な3Dパーツをその場で作ると120〜180分。人件費が跳ね上がり、回転率が落ちる。</p>
            </div>
          </div>
        </div>
      </section>

      <section id="process">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">How it works</p>
            <h2 className="display">画像1枚から量産まで、4ステップ</h2>
            <p>お客様がすることは、画像を送ることだけです。</p>
          </div>
          <div className="process">
            <div className="step">
              <div className="step-num">01</div>
              <h3>画像を送る</h3>
              <p>SNSやPinterestで見つけたイメージ画像、または手描きのラフを1枚DMまたはフォームで送信。</p>
            </div>
            <div className="step">
              <div className="step-num">02</div>
              <h3>AIが3Dモデル化</h3>
              <p>画像をもとにAIが立体データを自動生成。輪郭やディテールをすくい上げます。</p>
            </div>
            <div className="step">
              <div className="step-num">03</div>
              <h3>試作品3個を発送</h3>
              <p>黄変しないクリアレジンで試作。爪に乗せてサイズ感・施術感をご確認いただけます。</p>
            </div>
            <div className="step">
              <div className="step-num">04</div>
              <h3>50個から量産発注</h3>
              <p>気に入ったら本発注。型代不要、在庫リスクゼロで定番パーツに育てられます。</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="offer" id="offer">
            <div>
              <p className="eyebrow">First Give</p>
              <h2 className="display">まずは、無料で試してみてください。</h2>
              <p>初回限定で、試作品3個を送料のみでお届けします。実際に手に取って、透明感と精度を確かめてから量産をご検討ください。</p>
              <p>気に入らなければ、それで構いません。無理な営業は一切いたしません。</p>
            </div>
            <div className="offer-box">
              <div className="big">3個 / 無料</div>
              <div className="small">送料のみご負担（着払い対応可）・初回サロン様限定</div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Material</p>
            <h2 className="display">黄変しないクリアレジンと、無数のカラー</h2>
          </div>
          <div className="mat-grid">
            <div className="mat-copy">
              <p>ベースには耐黄変性の高い高透明クリアレジンを採用。着色剤を調合することで在庫リスクなく無数のカラーを展開できます。レシピはグラム数まで記録し、量産時の色ブレを防ぎます。</p>
              <p>爪のCカーブに合わせる熱加工にも対応。フラットな底面を熱で軟化させ、自然なフィット感に仕上げます。</p>
            </div>
            <div className="swatches">
              <div className="swatch" style={{ background: "#c9463c" }}><span>レッド</span></div>
              <div className="swatch" style={{ background: "#caa646" }}><span>ゴールド</span></div>
              <div className="swatch" style={{ background: "#7fd8cb" }}><span>ターコイズ</span></div>
              <div className="swatch" style={{ background: "#e7c9a9" }}><span>くすみ</span></div>
              <div className="swatch" style={{ background: "#f2e4d0" }}><span>シアー</span></div>
              <div className="swatch" style={{ background: "#8a5a34" }}><span>ブラウン</span></div>
              <div className="swatch" style={{ background: "#b98fd1" }}><span>パープル</span></div>
              <div className="swatch" style={{ background: "#f6a5c0" }}><span>ピンク</span></div>
              <div className="swatch" style={{ background: "#5c7ac9" }}><span>ブルー</span></div>
              <div className="swatch" style={{ background: "#2b2b2b" }}><span>ブラック</span></div>
              <div className="swatch" style={{ background: "#f4f0e6" }}><span>ホワイト</span></div>
              <div className="swatch" style={{ background: "#9fb98a" }}><span>グリーン</span></div>
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
              <tr><td>試作品（First Give）</td><td>3個</td><td>7〜10日</td><td className="hilite">送料のみ</td></tr>
              <tr><td>スモールロット</td><td>50個〜</td><td>2〜3週間</td><td>型代なし・色/形状の微調整1回まで無料</td></tr>
              <tr><td>定番化ロット</td><td>100個〜</td><td>3〜4週間</td><td>数量に応じて単価が下がります</td></tr>
              <tr><td>継続発注</td><td>毎月定量</td><td>ご相談</td><td>レシピ保管により色・形状を再現</td></tr>
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
              <div className="icon">🧴</div>
              <h3>雑貨として適正表示</h3>
              <p>本製品は「雑貨」です。自爪・皮膚への直接使用ではなく、ベースジェルを硬化させた上への装着を前提とした表記を徹底しています。</p>
            </div>
            <div className="trust-card">
              <div className="icon">🧤</div>
              <h3>安全な製造環境</h3>
              <p>ニトリル手袋・防毒マスク・強制換気のもとで製造。低アレルゲンレジンの採用も検討しています。</p>
            </div>
            <div className="trust-card">
              <div className="icon">📐</div>
              <h3>色・形状のレシピ管理</h3>
              <p>承認いただいた試作品の配合・形状データを保管。量産時も同じ品質を再現します。</p>
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
          <h2 className="display">まずは、気になる画像を1枚送ってください。</h2>
          <p>お見積もり・ご相談は無料です。Instagram DMまたはメールよりお気軽にどうぞ。</p>
          <div className="hero-cta" style={{ justifyContent: "center" }}>
            <a className="btn btn-primary" href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
              Instagramで相談する
            </a>
            <a className="btn btn-ghost" href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("ネイルパーツOEMのご相談")}`}>
              メールで相談する
            </a>
          </div>
        </div>
      </div>

      <footer>LUMINA CHARO — Nail Parts OEM</footer>
    </div>
  );
}
