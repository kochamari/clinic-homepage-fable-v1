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
- Node.js（**22 以上**）製のスクリプトが 2 本（開発サーバー・公開前検証）。
- npm の依存パッケージは**現状ゼロ**。

## フォルダ構成

```
/                  各ページの HTML（index / news / service / doctors /
                   access / contact / materials / privacy /
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

`http://127.0.0.1:4173` で表示されます。ポートは `PORT` 環境変数で変更できます。

```bash
PORT=4188 npm run dev
```

## 公開前検証

```bash
npm run build
```

GitHub Pages が `main` ブランチのルートを直接配信する構成に合わせ、次を検証します。

- 必須ファイルの存在
- HTML 内のローカルリンクとページ内アンカー
- 画像リンクと `alt` 属性
- JavaScript の構文
- HTML の基本構造（DOCTYPE、`lang`、主要要素、重複 `id` など）

検証スクリプトは `dist/` や Cloudflare Worker を生成しません。

### 休診カレンダーの年次更新

内閣府の「国民の祝日・休日」CSVから祝日データを生成し、GitHub Actionsが毎月更新を確認します。更新があった場合だけ `main` に自動反映するため、通常の年次作業は不要です。お盆・年末年始などの臨時休診は、該当するお知らせの `closures` に日付を追加するとカレンダーにも自動反映されます。診療状況とカレンダーは `Asia/Tokyo`（日本時間）を基準に表示します。

### Google Analytics 4

計測IDは `JS/site-config.js` の `gaMeasurementId` に1か所だけ設定します。空文字の間はGoogle Analyticsのスクリプトを読み込まず、解析通信、Cookie同意バナー、フッターの「Cookie設定」はすべて無効です。

有効な計測IDを設定すると、初回訪問時に同意バナーが表示されます。「同意する」を選んだ場合だけ計測を開始し、「拒否する」を選んだ場合は読み込みません。選択内容はブラウザの `localStorage` に保存され、フッターの「Cookie設定」から変更できます。同意を撤回した場合は、当サイトの `_ga` および `_ga_` で始まるCookieを可能な範囲で削除します。

## テスト・lint・型チェック

- **いずれも未設定です**（テストランナー・lint・型チェックのツールはありません）。
- JS の構文だけ確認したい場合は `node -c JS/script.js` が使えます。
- 新しいツールの導入は、事前に相談してから行ってください。

## 公開（GitHub Pages と独自ドメイン）

- 公開は **GitHub Pages**。`main` ブランチのルート（`/`）をそのまま配信します。
- 独自ドメイン `haraguchishoukakinaika.jp` は `CNAME` ファイルで設定しています。
  **`CNAME` は削除・変更しないでください。**
- **`main` への push は、そのまま本番サイトの更新につながる可能性があります。**
  push はユーザーの明示的な指示があるときだけ行ってください。

## AI での開発について

- このフォルダは **Codex と Claude Code が交代で使用**します。
- 一度に編集する AI は 1 つだけにしてください。
- 作業前に必ず **`AGENTS.md`** を読んでください（共通ルール）。
- Claude Code は加えて **`CLAUDE.md`** を読みます。
