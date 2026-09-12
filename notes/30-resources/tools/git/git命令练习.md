# Git 命令实验手册

本手册配合 [Git 团队协作与回滚手册](git使用手册.md) 使用。它不是命令清单，而是一组可重复的实验：每次操作前先预测 Git 会如何变化，再用状态和差异验证预测。

所有实验都在 `C:\Temp\git-command-lab` 中进行。这个目录是可删除的练习仓库，绝不能把 `reset --hard`、`rebase`、`restore` 或强制推送的练习直接用于真实项目。

## 0. 实验原则

每一道题都按相同顺序完成：

1. **预测**：命令会改变工作区、暂存区、提交历史中的哪一部分？
2. **执行**：一次只执行一条会改变状态的命令。
3. **观察**：使用 `git status`、`git diff`、`git diff --staged` 或 `git log` 验证结果。
4. **解释**：说明为什么结果符合或不符合预期。

Git 的核心不是记命令，而是知道三个区域当前各有什么内容：

| 区域 | 你看到的内容 | 常用观察命令 |
| --- | --- | --- |
| 工作区 | 磁盘上正在编辑的文件。 | `git diff` |
| 暂存区 | 下一次提交准备包含的内容。 | `git diff --staged` |
| `HEAD` | 当前分支最近一次提交的快照。 | `git show HEAD`、`git log` |

`git status` 不显示完整差异，它只告诉你哪些文件在三个区域之间存在差别。因此，遇到问题时先执行：

```bash
git status
git diff
git diff --staged
```

## 1. 创建可重复的实验仓库

### 1.1 准备条件

- 已安装 Git，并能在 PowerShell 中运行 `git --version`。
- `C:\Temp\git-command-lab` 不存在。若其中已有真实文件，换一个新目录，不要删除不确定的内容。

### 1.2 初始化

在 PowerShell 中逐行执行：

```powershell
$labPath = 'C:\Temp\git-command-lab'
New-Item -ItemType Directory -Path $labPath
Set-Location $labPath

git init
git switch -c master
git config user.name "Git Learner"
git config user.email "learner@example.com"

@'
# Git Command Lab

## Purpose
Practice Git commands safely.

## Notes
This line is intentionally separate from Purpose.
'@ | Set-Content -LiteralPath README.md

Set-Content -LiteralPath message.txt -Value '初始内容'
git add README.md message.txt
git commit -m "chore: initialize practice repository"
```

### 1.3 基线检查

```bash
git status --short
git branch --show-current
git log --oneline --decorate -n 3
```

预期结果：

- `git status --short` 没有输出，表示工作区和暂存区干净。
- 当前分支为 `master`。
- 历史中有一条 `chore: initialize practice repository` 提交。

如果状态不是干净的，不要开始后续实验。先运行 `git status` 找出原因，或重新创建一个新的实验目录。

## 2. 实验一：观察三个区域的变化

### 目标

亲眼观察同一行文字如何从工作区进入暂存区，再进入提交历史。

### 2.1 只修改工作区

在 `message.txt` 末尾添加一行：

```text
工作区修改
```

然后执行：

```bash
git status --short
git diff
git diff --staged
```

预期结果：

| 命令 | 应看到什么 | 原因 |
| --- | --- | --- |
| `git status --short` | ` M message.txt` | 第一个空格表示暂存区未变，`M` 表示工作区被修改。 |
| `git diff` | 新增的“工作区修改”一行 | 它比较工作区和暂存区。 |
| `git diff --staged` | 没有输出 | 暂存区仍与 `HEAD` 相同。 |

### 2.2 将修改加入暂存区

```bash
git add message.txt
git status --short
git diff
git diff --staged
```

预期结果：

| 命令 | 应看到什么 | 原因 |
| --- | --- | --- |
| `git status --short` | `M  message.txt` | 第一个 `M` 表示暂存区与 `HEAD` 不同；第二个位置为空，表示工作区和暂存区一致。 |
| `git diff` | 没有输出 | 工作区的内容已经与暂存区一致。 |
| `git diff --staged` | 新增的“工作区修改”一行 | 暂存区将比 `HEAD` 多出这行。 |

### 2.3 创建提交

```bash
git commit -m "docs: add working tree practice text"
git status --short
git show --stat --oneline HEAD
```

预期结果：工作区恢复干净，`HEAD` 指向刚刚创建的提交。

### 复盘

不用看上文，回答：为什么暂存后 `git diff` 为空，而 `git diff --staged` 有内容？

## 3. 实验二：用 `git add -p` 创建原子提交

### 目标

一次编辑常常包含多个意图。此实验要求你把同一文件中的两个改动拆成两次提交，而不是使用 `git add .` 全部提交。

### 3.1 制造两个相距较远的改动

编辑 `README.md`：

1. 将 `Practice Git commands safely.` 改为 `Practice Git commands safely with small, verifiable experiments.`
2. 在 `## Notes` 下再添加一行 `Temporary note: remove before release.`

先观察：

```bash
git diff README.md
```

你应看到两处相距较远的改动。这正是 `git add -p` 有价值的场景。

### 3.2 只暂存第一处改动

```bash
git add -p README.md
```

Git 会逐块显示改动并询问操作。此题中：

- 对 `Purpose` 相关的改动输入 `y`，暂存它。
- 对 `Temporary note` 相关的改动输入 `n`，跳过它。
- 如果 Git 将多处改动合并为一个块，输入 `s` 尝试拆分。
- 输入 `q` 可以随时退出，不会撤销已经暂存的改动。

现在检查：

```bash
git diff --staged
git diff
```

预期结果：

- `git diff --staged` 只有 `Purpose` 的修改。
- `git diff` 只有 `Temporary note` 的修改。

如果两个区域里都有相同内容，说明暂存范围不符合预期。使用 `git restore --staged README.md` 清空该文件的暂存状态，再重新执行 `git add -p`。

### 3.3 提交并验证原子性

```bash
git commit -m "docs: clarify lab purpose"
git show --format=fuller --stat HEAD
git diff
```

最近一次提交只应包含 `Purpose` 的改动；`Temporary note` 仍留在工作区。确认后再提交它：

```bash
git add README.md
git commit -m "docs: add temporary lab note"
```

### 复盘

一个提交为什么应当只有一个逻辑意图？请从代码审查、回滚和定位问题三个角度回答。

## 4. 实验三：本地分支、远程分支与 upstream

### 目标

不用 GitHub，也能理解 `origin` 和 `-u` 的含义。这里创建一个本地 bare repository 作为远程仓库。

### 4.1 创建本地 remote 并推送主分支

```powershell
Set-Location C:\Temp
git init --bare git-command-remote.git
Set-Location C:\Temp\git-command-lab
git remote add origin C:\Temp\git-command-remote.git
git push -u origin master
```

执行后的关系是：

```text
本地 master  --跟踪-->  origin/master
```

检查：

```bash
git remote -v
git branch -vv
```

`git branch -vv` 中的 `master` 后应显示 `[origin/master]`。这表示本地分支已设置 upstream，后续在该分支通常可以直接运行 `git push` 或 `git pull`。

### 4.2 创建并推送功能分支

```powershell
git switch -c feature/profile-message
Add-Content -LiteralPath message.txt -Value '功能分支新增内容'
git add message.txt
git commit -m "feat: update profile message"
git push -u origin feature/profile-message
```

检查：

```bash
git branch -vv
git log --oneline --decorate --all -n 8
```

预期结果：功能分支显示 `[origin/feature/profile-message]`，且远程跟踪分支和本地分支指向同一个提交。

### 复盘

`origin/master` 不是远程服务器上的实时分支，而是本地对远程分支位置的记录。它在什么操作之后才会更新？

## 5. 实验四：制造、理解并解决 rebase 冲突

### 目标

理解 rebase 冲突不是“Git 出错”，而是 Git 无法替你决定两套修改如何组合。

### 5.1 在功能分支修改同一行

确认当前分支为 `feature/profile-message`，再执行：

```powershell
Set-Content -LiteralPath message.txt -Value '功能分支内容'
git add message.txt
git commit -m "feat: change message on feature branch"
```

### 5.2 在主分支修改同一行

```bash
git switch master
```

然后执行：

```powershell
Set-Content -LiteralPath message.txt -Value '主分支内容'
git add message.txt
git commit -m "feat: change message on master"
```

### 5.3 在功能分支执行 rebase

```bash
git switch feature/profile-message
git rebase master
```

预期结果：Git 停止，并提示 `CONFLICT (content)`。此时不要执行 `git commit`，也不要直接删除整个文件。先观察：

```bash
git status
Get-Content message.txt
```

文件中会出现类似下面的冲突标记：

```text
<<<<<<< HEAD
主分支内容
=======
功能分支内容
>>>>>>> feat: change message on feature branch
```

在 rebase 过程中，`HEAD` 指向正在作为新基础的 `master` 内容；另一侧是当前正被重新应用的功能提交。

### 5.4 解决冲突并继续

将文件改为明确的最终业务内容，例如：

```text
主分支内容 + 功能分支内容
```

然后执行：

```bash
git add message.txt
git rebase --continue
git status
git log --oneline --graph --decorate --all -n 12
git push --force-with-lease
```

预期结果：工作区干净；功能分支提交位于 `master` 最新提交之后。提交 ID 会改变，因为 rebase 创建了新的提交。最后一条命令将个人功能分支安全更新到 remote；普通 `git push` 会因历史已经被 rebase 改写而拒绝这次更新。

### 5.5 两条恢复路径

| 情况 | 命令 | 含义 |
| --- | --- | --- |
| 冲突已经解决 | `git rebase --continue` | 继续应用余下提交。 |
| 想放弃整个 rebase | `git rebase --abort` | 回到 rebase 开始前的分支状态。 |

不要使用 `git reset --hard` 作为冲突处理的第一反应。先判断你要继续还是放弃当前操作。

## 6. 实验五：`restore`、`reset`、`revert` 的选择

### 目标

根据改动所处位置选择正确命令，而不是把所有“撤销”都交给 `reset`。

### 6.1 `git restore`：丢弃尚未暂存的文件修改

在 `README.md` 末尾增加：

```text
这行应该被丢弃。
```

观察后执行：

```bash
git diff README.md
git restore README.md
git diff README.md
```

预期结果：第二次 `git diff README.md` 没有输出。`git restore README.md` 默认使用暂存区作为来源，因此它只恢复工作区，不移动提交历史。

### 6.2 `git restore --staged`：取消暂存但保留工作区修改

在 `README.md` 添加：

```text
这行应该保留在工作区。
```

执行：

```bash
git add README.md
git restore --staged README.md
git status --short
git diff
git diff --staged
```

预期结果：

- `git status --short` 显示 ` M README.md`。
- `git diff` 显示新增行。
- `git diff --staged` 没有输出。

这说明暂存区已经回到 `HEAD`，而工作区修改仍被保留。

### 6.3 `git reset --soft`：撤销本地提交但保留暂存内容

```bash
git add README.md
git commit -m "docs: add reset practice text"
git reset --soft HEAD~1
git status --short
git diff --staged
git log --oneline -n 3
```

预期结果：最近一次提交从 `git log` 中消失，但它的内容仍在暂存区。适用于刚提交后发现需要拆分、补充或修改提交信息，且该提交尚未共享的情况。

### 6.4 `git revert`：用新提交撤销已经共享的提交

先重新提交上一步暂存的内容并推送功能分支：

```bash
git commit -m "docs: add reset practice text"
git push
git revert HEAD
git log --oneline -n 3
```

预期结果：历史新增一个 `Revert ...` 提交，原提交仍保留。这个模式适合已推送或已合并的提交，因为它不会改写其他人可能已经获取到的历史。

### 决策检查

| 场景 | 优先命令 | 为什么 |
| --- | --- | --- |
| 未暂存的单个文件修改错误 | `git restore <file>` | 只影响工作区。 |
| 已暂存但尚未提交 | `git restore --staged <file>` | 取消暂存，保留文件修改。 |
| 未推送的最近一次提交需要重做 | `git reset --soft HEAD~1` | 只移动本地分支，保留暂存内容。 |
| 已推送或已合并的提交需要撤销 | `git revert <commit-id>` | 新增反向提交，保留共享历史。 |

## 7. 实验六：使用 `reflog` 恢复误操作

### 目标

认识到分支引用移动后，近期提交通常仍可从引用日志找到。

### 7.1 制造可恢复的本地提交

确保在 `feature/profile-message` 分支，执行：

```powershell
Add-Content -LiteralPath message.txt -Value 'reflog 恢复练习'
git add message.txt
git commit -m "test: create reflog recovery point"
```

记录最新提交：

```bash
git log --oneline -n 2
```

### 7.2 移动分支并查看引用日志

```bash
git reset --hard HEAD~1
git reflog
```

在 `reflog` 输出中找到 `reset` 前的那条提交 ID。不要直接再做一次 reset，先将它固定到恢复分支：

```bash
git branch recovery/reflog-practice <commit-id>
git log --oneline recovery/reflog-practice -n 3
```

预期结果：`recovery/reflog-practice` 包含刚才被隐藏的恢复练习提交。

### 复盘

`reflog` 是本地引用变动记录，不等于远程备份。为什么误操作后应先停止继续清理或强制推送？

## 8. 实验七：使用 `git worktree` 并行处理任务

### 目标

不使用 stash，也能同时打开两个分支的文件。

### 8.1 创建第二个工作树

在主实验仓库中执行：

```powershell
Set-Location C:\Temp\git-command-lab
git worktree add ..\git-command-hotfix -b fix/message-typo master
```

检查：

```bash
git worktree list
```

预期结果：列表至少有两个目录：原仓库和 `git-command-hotfix`。后者检出 `fix/message-typo`。

### 8.2 在第二个目录独立提交

```powershell
Set-Location C:\Temp\git-command-hotfix
Add-Content -LiteralPath message.txt -Value 'hotfix: correct message typo'
git add message.txt
git commit -m "fix: correct message typo"
git branch --show-current
```

回到原仓库：

```powershell
Set-Location C:\Temp\git-command-lab
git status
git branch --show-current
git log --oneline --all -n 8
```

预期结果：原仓库仍在原分支，工作区未被 hotfix 目录的文件修改污染，但两边能看到相同的提交历史对象。

### 8.3 验证分支检出限制并清理

在原仓库尝试：

```bash
git switch fix/message-typo
```

Git 应拒绝该操作，因为分支已在另一个工作树中检出。这是保护机制，不是错误。

完成后，先确认 hotfix 工作树干净：

```powershell
Set-Location C:\Temp\git-command-hotfix
git status --short
Set-Location C:\Temp\git-command-lab
git worktree remove ..\git-command-hotfix
```

若 `git status --short` 有输出，先提交、恢复或暂存修改。不要用 `git worktree remove --force` 跳过检查。

## 9. 终局挑战：只给场景，不给命令

在不查看前文命令的情况下，为每个场景写出操作顺序和理由：

1. 你修改了三个文件，只想提交其中一个文件的部分改动。
2. 你误暂存了 `.env.local`，但需要保留该文件在磁盘上的修改。
3. 你刚在个人分支创建一个提交，发现提交信息写错，且从未推送。
4. 一个已经合并到主分支的提交导致线上错误，需要撤销它。
5. rebase 时发生冲突，但你发现这次同步不该继续。
6. 你误执行了本地 `reset --hard`，但还没有关闭终端或执行仓库清理。
7. 当前分支正在进行未提交的开发，但需要紧急修复另一个分支的问题。

完成后对照 [Git 团队协作与回滚手册](git使用手册.md)。能够解释每个选择影响的是工作区、暂存区、分支引用还是共享历史，才算真正掌握了这些命令。
