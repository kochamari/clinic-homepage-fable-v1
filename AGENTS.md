# AGENTS.md — 共通運用ルール（Codex / Claude Code 共通）

このファイルは、このリポジトリで作業するすべての AI（Codex・Claude Code）と
ユーザーが共有する**共通ルール**です。作業を始める前に必ず読んでください。

Claude Code は `CLAUDE.md`、Codex は本ファイル（`AGENTS.md`）を入口として読みますが、
**共通ルールはこの `AGENTS.md` に集約**しています。`CLAUDE.md` はこのファイルを参照します。

---

## プロジェクト

- 日本国内のクリニック「**原口消化器内科**」の公式ホームページ。
- **公開中の本番サイト**（独自ドメイン: `haraguchishoukakinaika.jp`）。
- 患者・家族・地域住民が閲覧する公開サイト。
- 正式リポジトリ: **`kochamari/clinic-homepage-fable-v1`**。
- 通常作業ブランチ: **`main`**。
- **`main` への push は本番公開につながる可能性がある。**

### 使用技術・構成

- **ビルドツールなしの静的サイト**（プレーンな HTML / CSS / JavaScript）。
- フレームワーク・トランスパイラ・バンドラは使っていない。
- Node.js スクリプト 2 本のみ（開発サーバーとビルド）。Node.js **22 以上**。
- npm の依存パッケージは**現状ゼロ**（`package.json` に dependencies なし）。

### ディレクトリ構成

```
/                     各ページの HTML（index, news, service, doctors,
                      access, contact, privacy, facility-standards, 404）
CSS/style.css         サイト全体のスタイル（デザイントークンは :root）
JS/                   サイトの JavaScript
  script.js           共通スクリプト（演出・メニュー・スクロール連動など）
  news-data.js        お知らせデータ（ここを編集して更新）
  news-loader.js      お知らせの読み込み・表示
  news-popup.js       重要なお知らせのポップアップ
  clinic-hours.js     診療時間の「診療中／休診」表示・休診カレンダー
  holidays-data.js    内閣府CSVから自動生成する祝日データ
images/               画像
PDF/                  配布用 PDF
scripts/
  dev.mjs             ローカル開発サーバー
  build.mjs           公開前のファイル検証
  update-holidays.mjs 内閣府CSVから祝日データを生成
.github/workflows/
  update-holidays.yml 祝日データの定期更新
docs/
  CLINIC_FACTS.md     クリニックの確定情報
  SITE_POLICY.md      文章・デザイン方針
CNAME                 旧GitHub Pages由来のファイル（勝手に削除・変更しない）
robots.txt            クローラー向け設定とサイトマップ案内
sitemap.xml           公開ページのサイトマップ
.claude/launch.json   Claude Code のプレビュー起動設定（共有）
```

### コマンド（実際に存在するものだけ）

| 目的 | コマンド | 備考 |
|---|---|---|
| 依存インストール | `npm install` | 依存はゼロ。実行しても何も入らないが害はない |
| 開発サーバー起動 | `npm run dev` | `http://127.0.0.1:4173`（`PORT` 環境変数で変更可） |
| 公開前検証 | `npm run build` | 必須ファイル・HTMLリンク・画像・JS構文・HTML基本構造を確認 |
| JS 構文チェック | `node -c JS/script.js` | 個別ファイルの構文確認に使える簡易手段 |

- **テスト・lint・型チェックのフレームワークは未設定**（存在しない）。
  勝手に導入せず、必要な場合はユーザーに提案する。
- 公開（デプロイ）は **Cloudflare Pages**。GitHub リポジトリと連携し、Production branch は **`main`**。
  `main` への push は Cloudflare Pages の本番デプロイを自動的にトリガーする。
- GitHub Pages は使用しない。勝手に再有効化しない。

---

## AI の使い分け

- Codex と Claude Code は**同じローカルフォルダを交代で使用**する。
- **一度に編集作業をする AI は 1 つだけ**。
- デザイン・文章・UI/UX は Claude Code を使うことがある。
- コード整理・設定・機能修正は Codex を使うことがある。
- **特定の AI がこのプロジェクトを所有しているとは考えない。**
- 他の AI やユーザーが行った変更を、**勝手に削除・上書き・巻き戻ししない**。

---

## 作業開始時のルール

1. 現在のブランチを確認する（`git branch --show-current`）。
2. `git status` を確認する。
3. **未コミットの変更がある場合は、作業を始めず状況を報告する**
   （別の AI やユーザーが作業中の可能性があるため）。
4. 未コミットの変更を、勝手に commit / stash / 破棄 / 上書きしない。
5. 作業ツリーがクリーンなときだけ、`main` を安全に最新化する
   （可能なら fast-forward のみ。問題が起きそうなら止めて説明する）。
6. 既存のファイル・構成を読んでから編集する。

---

## ブランチ運用

- **日常的な小規模修正は `main` で直接作業してよい**（一律禁止しない）。
- 大規模変更・全面リニューアル・実験的変更のときは、作業ブランチを**提案**する。
- ユーザーの指示なくブランチを作成・削除・マージしない。
- ユーザーの指示なく Pull Request を作成しない。

### Cloudflare Pages プレビュー運用（重要）

- ユーザーが「ブランチで作業してプレビューURLを見せて」など、**Cloudflare Pages のプレビュー確認を明示的に依頼した場合**は、その依頼を「作業ブランチの作成・commit・Preview Deployment の確認、およびPreview URLを確実に取得するために必要な Pull Request 作成」までの許可とみなしてよい。
- ただし、**Pull Request の merge、`main` への反映、本番公開は別操作**であり、ユーザーの明示的な許可なしに実行しない。
- Cloudflare Pages の `*.pages.dev` URLを、**プロジェクト名・ブランチ名・commit SHA などから推測、組み立て、類推して提示してはならない**。ブランチaliasが存在するとは限らず、各Deploymentのhash URLも推測不能である。
- ユーザーに渡すPreview URLは、**Cloudflare Pages が実際に発行したURLを確認できたものだけ**にする。GitHub PRのDeployment / Check / Status / コメントなど、Cloudflare連携が返した実データを優先して取得する。
- 実URLを取得できない場合は、推測URLを代わりに出さず、**「Preview Deploymentは作成されたがURLをこちらから検証できない」など、確認できた範囲を正確に報告する**。
- 可能な環境では、URL提示前にHTTPで実際にアクセスし、少なくともページが正常応答することを確認する。さらに可能なら、依頼した変更がPreview上に表示されていることまで確認する。
- Cloudflare管理画面へのログインをユーザーに求めるのは最後の手段とする。GitHub側から取得・検証できる情報がある場合は、AI側で完結させる。
- 一時的なデプロイ発火用ファイルなどを作成した場合は、**最終差分に不要物を残さない**。作業終了時に `main` との差分を確認し、依頼された変更だけが残っていることを確認する。

---

## 編集時のルール

- 依頼された範囲だけを変更する。無関係なファイルを不用意に変更しない。
- サイト全体の書き換えや大規模な依存関係変更を勝手に行わない。
- 新しいパッケージ・外部サービス（解析・広告・外部フォーム・CDN 等）を
  追加する前に、必ず許可を得る。
- 既存のデザインシステム（余白・色・タイポグラフィ）を尊重する（`docs/SITE_POLICY.md`）。
- クリニックの住所・電話番号・診療時間・診療内容などを**推測で変更しない**。
  確定情報は `docs/CLINIC_FACTS.md` を使う。
- 不明な情報は創作せず、`TODO:` または確認事項として報告する。
- 医療効果を保証する表現・過度な比較・誇大表現を勝手に追加しない（`docs/SITE_POLICY.md`）。
- 患者情報、症例を特定できる情報、スタッフの非公開情報を保存しない。
- API キー・パスワード・トークン・秘密情報・`.env` の内容をコミットしない。

---

## 年次運用

- 診療日カレンダーの祝日データは、内閣府CSVから `JS/holidays-data.js` へ自動生成する。
- `.github/workflows/update-holidays.yml` が毎月、データ変更時だけ `main` に自動反映する。通常の年次作業は不要。
- 緊急時はGitHub Actionsの手動実行でも更新できる。
- お盆・年末年始などの臨時休診は、`JS/news-data.js` の該当お知らせに `closures` を記載すると、カレンダーにも自動反映される。
- 診療状況と診療日カレンダーの判定基準は `Asia/Tokyo`（日本時間）とする。

---

## 作業終了時のルール

- 利用可能なビルド（`npm run build`）を実行する。
- 必要に応じてローカルプレビュー（`npm run dev`）を確認する。
- エラーや警告を報告する。
- 変更したファイルを一覧で報告する。
- 変更内容を分かりやすく要約する。
- 未解決の問題があれば明記する。
- **ユーザーの明示的な指示なく commit しない。**
- **ユーザーの明示的な指示なく push しない。**
- `main` への push は本番公開につながる可能性があると認識する。
- push を依頼された場合も、直前に **ブランチ・`git status`・差分・ビルド結果**を再確認し、
  本番反映の可能性を伝えてから実行する。

---

## 禁止する Git 操作

ユーザーから明示的に依頼されない限り、以下を実行しない。

- `git reset --hard`
- `git clean`
- `git restore` / `git checkout --` による未確認変更の破棄
- force push（`--force` / `--force-with-lease`）
- rebase
- Git 履歴の書き換え
- ブランチ削除
- リポジトリ削除
- remote の追加・変更・削除
- 未コミット変更の自動 stash / 自動 commit

---

## リポジトリ・公開に関する注意

- remote は `origin`（= `kochamari/clinic-homepage-fable-v1`）のみを使う。
  古いリポジトリ `haraguchi-clinic-home-page-codex-ver` は使わない・接続しない。
- `CNAME`（`haraguchishoukakinaika.jp`）は勝手に削除・変更しない。
- Cloudflare Pages、Cloudflare DNS、独自ドメイン設定を勝手に変更しない。
- GitHub Pages は無効のまま維持し、勝手に再有効化しない。

---

## 関連ドキュメント

- `CLAUDE.md` — Claude Code 固有のルール（本ファイルを参照する）。
- `README.md` — 開発者向けの概要・コマンド。
- `docs/CLINIC_FACTS.md` — クリニックの確定情報。
- `docs/SITE_POLICY.md` — 文章・デザイン・アクセシビリティ方針。
