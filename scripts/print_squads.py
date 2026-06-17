"""Print squad reference tables to stdout or a markdown file."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "squads.json"
OUT = ROOT / "data" / "SQUADS.md"


def main():
    data = json.loads(DATA.read_text(encoding="utf-8"))
    lines = [
        "# Fantasy Build — Squad Reference",
        "",
        "Stats: **PAC** Pace | **POW** Power | **STA** Stamina | **TCK** Tackling | **PAS** Passing | **GK** Goalkeeping",
        "",
        "OVR = Pace×0.18 + Power×0.18 + Stamina×0.18 + Tackling×0.18 + Passing×0.18 + GK×0.10",
        "",
        "## Team Ratings",
        "",
        "| Universe | Team OVR |",
        "|----------|----------|",
    ]

    summaries = []
    for u in data["universes"]:
        team_ovr = round(sum(p["ovr"] for p in u["players"]) / len(u["players"]), 1)
        summaries.append((team_ovr, u["name"]))
    for team_ovr, name in sorted(summaries, reverse=True):
        lines.append(f"| {name} | {team_ovr} |")
    lines.append("")

    for u in data["universes"]:
        players = u["players"]
        team_ovr = round(sum(p["ovr"] for p in players) / len(players), 1)
        lines.append(f"## {u['name']} — Team OVR **{team_ovr}**")
        lines.append(f"*{u['tagline']}*")
        lines.append("")
        lines.append("| Player | OVR | PAC | POW | STA | TCK | PAS | GK |")
        lines.append("|--------|-----|-----|-----|-----|-----|-----|-----|")
        for p in sorted(players, key=lambda x: x["ovr"], reverse=True):
            s = p["stats"]
            lines.append(
                f"| {p['name']} | {p['ovr']} | {s['pace']} | {s['power']} | {s['stamina']} | "
                f"{s['tackling']} | {s['passing']} | {s['gk']} |"
            )
        avgs = {
            k: round(sum(p["stats"][k] for p in players) / len(players), 1)
            for k in ["pace", "power", "stamina", "tackling", "passing", "gk"]
        }
        lines.append(
            f"| **Squad Average** | — | **{avgs['pace']}** | **{avgs['power']}** | "
            f"**{avgs['stamina']}** | **{avgs['tackling']}** | **{avgs['passing']}** | **{avgs['gk']}** |"
        )
        lines.append("")

    text = "\n".join(lines)
    OUT.write_text(text, encoding="utf-8")
    print(f"Wrote {OUT}")
    if "--stdout" in sys.argv:
        print(text)


if __name__ == "__main__":
    main()
