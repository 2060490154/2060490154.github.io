---
author : 异想天开的出题者
pubDatetime: 2022-09-23T15:22:00Z
modDatetime: 2023-12-21T09:12:47.400Z
title: 在astro官网学习过程
featured: true
draft: false
tags:
  - docs
description:
  Some rules & recommendations for creating or adding new posts using AstroPaper
  theme.
---
## 安装必要的软件
确保安装了npm，pnpm，nodejs以及git。其中pnpm是npm的上位替代
## 利用npm/pnpm创建环境
```
pnpm create astro@latest --template minimal

```
后面会让你选择文件夹的名字，以及是否安装依赖以及git初始化
可能会因为网络问题，不能正常的访问，需要我们配置pnpm的代理，打开.npmrc文件写入以下命令,通常文件位于user/yourname目录下
```
proxy=http://127.0.0.1:7897
https-proxy=http://127.0.0.1:7897       

```
启动astro服务
```
pnpm run dev
```
## 对页面进行更新
开启服务后不需要重新打开，会自动更新，打开src/pages/index.astro文件，修改
```
<body>
		<h1>我的Astro站点</h1>
	</body>

```
打开浏览器观察到标题已发生改变
## 将本地代码与github仓库进行同步
首先在github建立"用户名.github.io"的仓库，接着在本地将git与自己账户关联起来。
```
git config --global user.name "testname" 
 
git config --global user.email "abc@example.com" 
```
运行以下命令同步远程仓库
```
git add . #将本地文件添加到暂存区
git commit -m "add a change" #将暂存区转到本地git版本库中

git push -u origin main #将远程仓库与本地仓库进行同步 
```
## 部署到netlify
我是之前部署到了cloudflare上，其实自己也有一台github学生包送的服务器，到时候有空了可以再换个地方部署


## 添加新页面
在src/pages下新建一个about.md文件
可以将index.astro的内容复制过去，或者自己在<body></body>两个标签间创建自己的内容。在两个.astro文件的<h1>标签之前添加
```
<a href="/">首页</a>
<a href="/about/">关于</a>

```
实现顶部分导航设置，并支持跳转

## 添加博客
在src/pages下新建一个文件夹posts，创建post_1.md，输入一下内容
```---
title: '我的第一篇博客文章'
pubDate: 2022-07-01
description: '这是我 Astro 博客的第一篇文章。'
author: 'Astro 学习者'
image:
    url: 'https://docs.astro.build/assets/rose.webp'
    alt: 'The Astro logo on a dark background with a pink glow.'
tags: ["astro", "blogging", "learning in public"]
---

# 我的第一篇博客文章

 发表于：2022-07-01

 欢迎来到我学习关于 Astro 的新博客！在这里，我将分享我建立新网站的学习历程。

 ## 我做了什么

 1. **安装 Astro**：首先，我创建了一个新的 Astro 项目并设置好了我的在线账号。

 2. **制作页面**：然后我学习了如何通过创建新的 `.astro` 文件并将它们保存在 `src/pages/` 文件夹里来制作页面。

 3. **发表博客文章**：这是我的第一篇博客文章！我现在有用 Astro 编写的页面和用 Markdown 写的文章了！

 ## 下一步计划

 我将完成 Astro 教程，然后继续编写更多内容。关注我以获取更多信息。
```
通过访问http://localhost:4321/post_1可以看到我们发表的第一篇博客
在blog.astro中添加一下代码实现正文引用博客
```
    <ul>
      <li><a href="/posts/post-1/">文章 1</a></li>
    </ul>
```
## 在博客中添加javascript代码
在 frontmatter 中的代码栅栏之间添加以下一行 JavaScript：
```
---
const pageTitle = "关于我";
---
```
即可以在正文中调用变量pageTitle
```
 - <title>Astro</title>
 + <title>{pageTitle}</title>

- <h1>关于我</h1>
+ <h1>{pageTitle}</h1>
```
另外可以调用字典和列表。
```
---
const identity = {
  firstName: "莎拉",
  country: "加拿大",
  occupation: "技术撰稿人",
  hobbies: ["摄影", "观鸟", "棒球"],
};

const skills = ["HTML", "CSS", "JavaScript", "React", "Astro", "Writing Docs"];
---
```
在about.astro中添加以下代码观察列表和字典的表现
```
<p>以下是关于我的几个事实：</p>
<ul>
  <li>我的名字是{identity.firstName}.</li>
  <li>我住在{identity.country}。我的职业是{identity.occupation}。</li>
  {identity.hobbies.length >= 2 &&
    <li>我的两个习惯：{identity.hobbies[0]}和{identity.hobbies[1]}</li>
  }
</ul>
<p>我的技能是：</p>
<ul>
  {skills.map((skill) => <li>{skill}</li>)}
</ul>
```
同时也有bool类型 
## 应用样式
添加以下代码，来改变元素的颜色字体及相关样式
```

	<style>
      h1 {
        color: green;
        font-size: 4rem;
      }
       .skill {
   color: purplue;
 }
    </style>
```

## 添加全局样式
在src/styles/下创建gloabl.css文件，添加以下代码
```
html {
  background-color: #f1f5f9;
  font-family: sans-serif;
}

body {
  margin: 0 auto;
  width: 100%;
  max-width: 80ch;
  padding: 1rem;
  line-height: 1.5;
}

* {
  box-sizing: border-box;
}

h1 {
  margin: 1rem 0;
  font-size: 2.5rem;
}
```
再将以下代码加入about.astro的frontmatter中实现样式的改变
```
import '../styles/global.css';
```
## 


