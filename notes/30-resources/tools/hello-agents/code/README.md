# Hello Agents 代码环境

本项目使用 Python 虚拟环境管理依赖。请在当前 `code/` 目录执行以下命令。

## 创建虚拟环境

```powershell
python -m venv .venv
```

## 激活虚拟环境

```powershell
.\.venv\Scripts\Activate.ps1
```

## 安装依赖

```powershell
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

如果 PowerShell 无法激活虚拟环境，直接使用虚拟环境中的 Python 安装依赖：

```powershell
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt
```
