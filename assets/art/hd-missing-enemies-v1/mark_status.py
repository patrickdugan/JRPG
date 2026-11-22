#!/usr/bin/env python3
"""Mark committed source-derived assets in the repo's canonical status ledger."""
from pathlib import Path
import json
from build import ROSTER,GROUPS,REPO

data=json.loads(ROSTER.read_text(encoding="utf8"))
wanted=set(id for _,ids in GROUPS for id in ids)
count=0
for row in data["identities"]:
    if row["id"] in wanted:
        assert row["paintedKeyArt"]=="pending" and row["kind"]=="regular-enemy"
        row["assetInGit"]=True
        row["engineIntegrated"]="optional-source-derived-fallback"
        row["sourceDerivedStatus"]="committed-provisional"
        count+=1
assert count==16
ROSTER.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf8")

readme=ROSTER.with_name("README.md")
src=readme.read_text(encoding="utf8")
heading="| Canonical ID | Kind | Family | Painted master | 24f motion | Binary Git | Engine | Visual review |"
begin=src.index(heading)
end=src.index("\n\n## Acceptance gates",begin)
lines=[
    heading,
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
]
for row in data["identities"]:
    lines.append("| "+row["id"]+" | "+row["kind"]+" | "+row["family"]+" | "
        +row["paintedKeyArt"]+" | "+row["hdMotion24"]+" | "
        +("source-derived committed" if row["id"] in wanted else ("yes" if row["assetInGit"] else "pending"))
        +" | "+row["engineIntegrated"]+" | "+row["visualApproval"]+" |")
readme.write_text(src[:begin]+"\n".join(lines)+src[end:],encoding="utf8")
print("Updated Roster Keystone status for",count,"source-derived committed enemies")
