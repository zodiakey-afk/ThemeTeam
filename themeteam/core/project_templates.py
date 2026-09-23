from __future__ import annotations

from pathlib import Path

BAZI_INDEX = """<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>八字预测 · 传统文化演示</title><link rel="stylesheet" href="./styles.css"></head>
<body><main class="app"><header><p class="eyebrow">THEMETEAM DEMO PROJECT</p><h1>八字预测</h1>
<p>传统文化排盘与娱乐性解读演示，不构成科学结论或现实决策建议。</p></header>
<section class="panel"><form id="form"><label>出生日期<input id="date" type="date" required value="1995-05-18"></label>
<label>出生时间<input id="time" type="time" required value="14:30"></label><label>出生地<input id="place" required value="北京"></label>
<button>生成排盘</button></form></section><section id="result" class="panel"><p class="muted">填写信息后生成四柱演示。</p></section>
<footer>由 ThemeTeam 受控 Mock Runtime 生成，仅用于工程开发效果验收。</footer></main><script src="./app.js"></script></body></html>"""
BAZI_CSS = """*{box-sizing:border-box}body{margin:0;background:#f5efe7;color:#332b28;font:16px/1.6 system-ui,"Microsoft YaHei",sans-serif}.app{width:min(920px,calc(100% - 32px));margin:auto;padding:40px 0}.eyebrow{color:#9a6846;font-size:12px;letter-spacing:.12em}h1{font-size:42px;color:#5d3a2b}header p{color:#6f5c51}.panel{background:#fffaf4;border:1px solid #dfcdbb;border-radius:12px;padding:22px;margin:16px 0;box-shadow:0 10px 30px #5d3a2b12}form{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;align-items:end}label{display:grid;gap:6px;color:#6f5c51;font-size:13px}input{padding:10px;border:1px solid #d7c2ae;border-radius:7px}button{padding:11px 16px;border:0;border-radius:7px;background:#8d5134;color:white;font-weight:700}.pillars{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.pillar{padding:14px;text-align:center;background:#f0e0d0;border-radius:8px}.pillar strong{display:block;font-size:24px;color:#6b3b29}.muted,footer{color:#806f63;font-size:13px}footer{text-align:center;padding:18px}@media(max-width:680px){form{grid-template-columns:1fr}.pillars{grid-template-columns:repeat(2,1fr)}h1{font-size:34px}}"""
BAZI_JS = """const h=['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'],e=['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'],r=document.querySelector('#result');document.querySelector('#form').addEventListener('submit',x=>{x.preventDefault();const d=new Date(document.querySelector('#date').value+'T'+document.querySelector('#time').value),s=d.getFullYear()+d.getMonth()+1+d.getDate()+d.getHours();const p=Array.from({length:4},(_,i)=>'<div class="pillar"><strong>'+h[(s+i)%10]+e[(s+i*3)%12]+'</strong><span>演示柱</span></div>');r.innerHTML='<p><b>'+document.querySelector('#place').value+'</b> · 传统历法四柱演示</p><div class="pillars">'+p.join('')+'</div><p class="muted">结果仅用于传统文化体验，不用于现实决策。</p>'})"""


def generate_bazi_project(root: Path, project_name: str) -> Path:
    safe = "".join(char for char in project_name.strip() if char.isalnum() or char in "-_")
    if not safe:
        raise ValueError("Invalid project name")
    project = (root / "projects" / safe).resolve()
    project.relative_to(root.resolve())
    project.mkdir(parents=True, exist_ok=True)
    (project / "index.html").write_text(BAZI_INDEX, encoding="utf-8")
    (project / "styles.css").write_text(BAZI_CSS, encoding="utf-8")
    (project / "app.js").write_text(BAZI_JS, encoding="utf-8")
    (project / "README.md").write_text(
        "# 八字预测示例项目\n\n"
        "由 ThemeTeam 受控 Mock Runtime 生成。\n"
        "这是传统文化/娱乐性演示，不构成科学结论或现实决策建议。\n",
        encoding="utf-8",
    )
    return project
