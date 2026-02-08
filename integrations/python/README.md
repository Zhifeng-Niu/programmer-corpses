# 🐍 Code Corpses Python Version
# pip install code-corpses
# 
# 让 Python 开发者也能愉快地管理墓地

code_corpses/
├── __init__.py
├── cli.py              # CLI 入口
├── scanner.py          # GitHub 扫描器
├── zombie.py           # 诈尸检测
├── config.py          # 配置管理
└── templates/         # 墓碑模板

# 安装方式
# pip install code-corpses

# 使用方式
# code-corpses --visit
# code-corpses scan --repo my-project
# code-corpses --stats

# Python API
# from code_corpses import Cemetery
# cemetery = Cemetery()
# tomb = cemetery.random_tomb()
# print(tomb)
