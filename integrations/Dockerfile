# 🐳 Code Corpses Docker Image
# 一行命令，在任何地方运行墓地

FROM node:18-alpine

LABEL maintainer="Zhifeng-Niu"
LABEL description="🪦 代码尸体集中营 - AI时代的代码轮回中转站"

WORKDIR /app

# 安装 code-corpses
RUN npm install -g code-corpses

# 创建别名
RUN ln -s /usr/local/lib/node_modules/code-corpses/dist/index.js /usr/local/bin/cemetery

WORKDIR /workspace

# 默认命令
CMD ["cemetery", "--visit"]

# 构建命令
# docker build -t code-corpses .
# 
# 使用方式：
# docker run --rm -it code-corpses --visit
# docker run --rm -it code-corpses --stats
# docker run --rm -it code-corpses --help
#
# 挂载自定义配置：
# docker run --rm -v $(pwd)/cemetery.config.yaml:/app/cemetery.config.yaml code-corpses --scan
