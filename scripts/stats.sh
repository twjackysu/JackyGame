# 成果發表用的統計（第 79 輪）：scripts/stats.sh → 印出 commit 數、開發迴圈輪數、程式行數、測試數，給 README 用。
# 排程的 clone 是 --depth 50，要先補完整歷史才算得準。
cd "$(dirname "$0")/.." || exit 1
if [ "$(git rev-parse --is-shallow-repository)" = "true" ]; then git fetch -q --unshallow origin main 2>/dev/null || git fetch -q --unshallow; fi
echo "commit 總數：$(git rev-list --count HEAD)"
echo "開發迴圈輪數（acquire lock 次數）：$(git log --format=%s | grep -c '^loop: acquire lock')"
echo "最後一則 PROGRESS：$(grep -m1 -o '第 [0-9]* 輪' docs/PROGRESS.md)"
echo "第一個 commit：$(git log --reverse --format='%ad' --date=format:'%Y-%m-%d %H:%M' | head -1)"
echo "TypeScript 行數（src）：$(find src -name '*.ts' -print0 | xargs -0 cat | wc -l)"
echo "測試檔／測試數：$(ls tests/*.test.ts | grep -v '/zz-' | wc -l) 檔／$(grep -ho "^\s*\(it\|test\)(" tests/*.test.ts | wc -l) 項（vitest 實跑數以 npx vitest run 為準）"
echo "決策編號到：$(grep -o '^##* D-[0-9]*' docs/DECISIONS.md | grep -o '[0-9]*' | sort -n | tail -1)"
