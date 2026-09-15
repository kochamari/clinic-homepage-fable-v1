# 原口消化器内科 ホームページ

長崎県佐世保市の「原口消化器内科」公式ホームページのソースコードです。
**公開中の本番サイト**（独自ドメイン: `haraguchishoukakinaika.jp`）です。

---

## このリポジトリの目的

- クリニックの公式サイトを管理・更新する。
- 患者・家族・地域住民に、診療内容・診療時間・アクセス・お知らせを届ける。
- スマートフォンでの見やすさと、高齢の方への読みやすさを優先する。

## 使用技術

- **ビルドツールなしの静的サイト**（プレーンな HTML / CSS / JavaScript）。
- フレームワーク・バンドラ・トランスパイラは使っていない。
- Node.js（**22 以上**）の標準機能で、開発サーバー・公開前検証・祝日更新・回帰テストを実行。
- npm の依存パッケージは**現状ゼロ**。

## フォルダ構成

```
/                  各ページの HTML（index / news / service / doctors /
                   access / contact / privacy /
                   facility-standards / 404）
CSS/style.css      サイト全体のスタイル
JS/                サイトの JavaScript（お知らせ・演出・診療時間表示・祝日データなど）
images/            画像
PDF/               配布用 PDF
scripts/           dev.mjs（開発サーバー） / build.mjs（公開前検証） /
                   update-holidays.mjs（祝日データ生成）
.github/workflows/ update-holidays.yml（祝日データの定期更新）
docs/              CLINIC_FACTS.md（確定情報） / SITE_POLICY.md（方針）
CNAME              独自ドメイン設定（変更しない）
robots.txt         クローラー向け設定とサイトマップ案内
sitemap.xml        公開ページのサイトマップ
AGENTS.md          AI・開発者共通の運用ルール
CLAUDE.md          Claude Code 向けルール（AGENTS.md を参照）
```

## セットアップ

依存パッケージはありませんが、慣例として実行できます。

```bash
npm install
```

## 開発サーバーの起動

```bash
npm run dev
```

`http://127.0.0.1:4173` で表示されます。ポートは `PORT` 環境変数で変更できます。存在しないパスは `404.html` をHTTP 404で返します（Cloudflare上の応答とは別のローカル検証です）。

```bash
PORT=4188 npm run dev
```

## 公開前検証

```bash
npm run build
```

Cloudflare Pagesで配信する静的ファイルについて、次を検証します。

- 必須ファイルの存在
- HTML 内のローカルリンクとページ内アンカー
- 画像リンクと `alt` 属性
- JavaScript の構文
- HTML の基本構造（DOCTYPE、`lang`、主要要素、重複 `id` など）
- JSON-LDのJSON構文（Schema.org上の意味や実態との一致は別途確認）

検証スクリプトは `dist/` や Cloudflare Worker を生成しません。

### 休診カレンダーの年次更新

内閣府の「国民の祝日・休日」CSVから祝日データを生成し、GitHub Actionsが毎月更新を確認します。更新があった場合だけ `main` に自動反映するため、通常の年次作業は不要です。お盆・年末年始などの臨時休診は、該当するお知らせの `closures` に日付を追加するとカレンダーにも自動反映されます。診療状況とカレンダーは `Asia/Tokyo`（日本時間）を基準に表示します。

祝日更新はHTTP・CSV・実在日・年ごとの件数と範囲・既存日の欠落を検証し、成功後だけ一時ファイルから置き換えます。同じ内容なら更新しません。翌年が未公表でも当年分が揃っていれば許容します。公式の訂正で既存日が削除される場合も自動反映を停止するため、根拠を確認してから対応してください。ワークフローは更新後に `npm test` と `npm run build` を通してから既存のcommit/push処理へ進みます。

`nationalHolidayCoverage` の対象年は12月31日まで有効です。必要な祝日・お知らせデータの欠落や不正、対象年外では診療状況を「確認できません」と表示します。正常な空のお知らせ配列は利用可能です。臨時休診 `closures`・医師変更 `doctorChanges` はお知らせの掲載期限とは独立して適用します。

お知らせの日付判定は `JS/date-utils.js` に共通化し、日本時間の掲載開始日〜終了日（両端含む）を使用します。ポップアップはさらに `popup: true` と `popupUntil` をすべて満たす必要があります。未指定の期限は許容しますが、空文字・不正日付・逆転期間は非掲載にします。深夜0時・タブ復帰・ページ復帰時に更新し、同一内容のDOMは保持します。

### Google Analytics 4

計測IDは `JS/site-config.js` の `gaMeasurementId` に1か所だけ設定します。空文字の間はGoogle Analyticsのスクリプトを読み込まず、解析通信も行いません。

有効な計測IDがあり、HTTPSのホスト名が `analyticsHosts` の確認済み本番ホスト `haraguchishoukakinaika.jp` に完全一致する場合だけ、Google Analytics 4を開始します。www、ローカル、file、Cloudflareプレビュー等では初期化しません。広告関連の設定は無効化し、ページURLからクエリ・フラグメントを除いて送信します。計測用のCookieバナーおよびフッターの「Cookie設定」は使用しません。

## テスト・lint・型チェック

- `npm test` でNode.js標準の `node:test` / `node:assert` による回帰テストを実行します（追加依存なし）。
- `tests/` は本体JSを読み込むか本体スクリプトをimportし、受付境界・日本時間・データ異常・祝日更新のファイル保護・GA・主要ページの整合性を検証します。外部通信はモックします。
- ブラウザーでの操作・表示確認は別途行います。検証記録は `docs/REVIEW_2026-09-15.md` を参照。
- lint・型チェックのフレームワークは未設定です。
- JS の構文だけ確認したい場合は `node -c JS/script.js` が使えます。
- 新しいツールの導入は、事前に相談してから行ってください。

## 公開（Cloudflare Pages と独自ドメイン）

- 公開は **Cloudflare Pages**。正式リポジトリ `kochamari/clinic-homepage-fable-v1` と連携し、Production branch は `main` です。GitHub Pagesは使用しません。
- 独自ドメインは `haraguchishoukakinaika.jp`。旧GitHub Pages由来の **`CNAME` は削除・変更しないでください。**
- Preview URLはCloudflareが発行した実URLを確認して使用します。今回のローカル検証では配信設定・ヘッダー・検索登録状況を確認したことにはなりません。
- **`main` への push は、そのまま本番サイトの更新につながる可能性があります。**
  push はユーザーの明示的な指示があるときだけ行ってください。

## AI での開発について

- このフォルダは **Codex と Claude Code が交代で使用**します。
- 一度に編集する AI は 1 つだけにしてください。
- 作業前に必ず **`AGENTS.md`** を読んでください（共通ルール）。
- Claude Code は加えて **`CLAUDE.md`** を読みます。
