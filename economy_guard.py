#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v960 economy, progression, documentation, and release contract guard.

This is intentionally a release-blocking guard rather than a smoke test.  It
checks the shared modules, every one of the 27 playable pages, and all versioned
Node regression tests.  Checks are accumulated so a single run reports every
drift instead of stopping at the first failure.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from pathlib import Path
import re
import shutil
import subprocess
import sys


ROOT = Path(__file__).resolve().parent

REGULAR_IDS = (
    "action", "adjective", "animal", "body", "city", "clothes", "color",
    "family", "food", "home", "job", "nature", "question", "school",
    "sports", "time", "traffic", "treasure", "season",
)
PLAYABLE_PAGES = tuple(f"island_{name}.html" for name in REGULAR_IDS) + tuple(
    f"island_land{i}.html" for i in range(1, 9)
)

PASS: list[tuple[str, str]] = []
FAIL: list[tuple[str, str, str]] = []
TEST_OUTPUT: dict[str, str] = {}


def read(name: str) -> str:
    path = ROOT / name
    if not path.is_file():
        return ""
    return path.read_text(encoding="utf-8", errors="replace")


def require(category: str, name: str, condition: bool, detail: str = "") -> None:
    if condition:
        PASS.append((category, name))
    else:
        FAIL.append((category, name, detail))


def has_all(source: str, *tokens: str) -> bool:
    return all(token in source for token in tokens)


def missing_tokens(source: str, tokens: tuple[str, ...] | list[str]) -> list[str]:
    return [token for token in tokens if token not in source]


def compact_names(names: list[str], limit: int = 8) -> str:
    if not names:
        return ""
    shown = names[:limit]
    suffix = f" …另 {len(names) - limit} 项" if len(names) > limit else ""
    return ", ".join(shown) + suffix


def function_slice(source: str, signature: str) -> str:
    """Return a top-level function's source, good enough for ordering guards."""
    start = source.find(signature)
    if start < 0:
        return ""
    nxt = re.search(r"\nfunction\s+[A-Za-z_$][\w$]*\s*\(", source[start + len(signature):])
    end = start + len(signature) + nxt.start() if nxt else len(source)
    return source[start:end]


def script_positions(html: str, filename: str) -> list[int]:
    """Find actual external-script tags, ignoring filenames mentioned in comments."""
    pattern = re.compile(
        r"<script\b[^>]*\bsrc\s*=\s*['\"][^'\"]*" + re.escape(filename) + r"[^'\"]*['\"][^>]*>",
        re.I,
    )
    return [match.start() for match in pattern.finditer(html)]


def check_basics() -> None:
    category = "基础"
    require(category, "VERSION 固定为 960", read("VERSION").strip() == "960",
            f"实际为 {read('VERSION').strip()!r}")
    required = (
        "hansen_canonical_progress.js", "hansen_quest_global.js",
        "hansen_island_upgrade.js", "hansen_spellbee.js",
        "hansen_spellbee_gems.js", "spelling_bee.html",
        "hansen_checkin_global.js", "hansen_addiction.js",
        "hansen_round_reward.js", "hansen_crystal.js",
        "hansen_pet_showcase.js", "hansen_focused_typing_v946.js",
        "hansen_explore_progress_v945.js", "hansen_econ_guide.js",
        "hansen_backup_bootstrap_v944.js", "hansen_backup_v944.js",
        "package_release.py", "README.md",
        "apply_user_food_icons_v958.mjs", "test_food_word_icons_v958.mjs",
        "test_boss_naming_v959.mjs", "test_food_icon_compression_v960.mjs",
        ".github/workflows/jarvis-three-file-release.yml", "package.json", "package-lock.json",
        "requirements-audit.txt", "hansen_health_check.py", "jarvis_scan.py",
    )
    absent = [name for name in required if not read(name).strip()]
    require(category, "v960 关键文件齐全", not absent,
            "缺失/为空: " + compact_names(absent))
    missing_pages = [name for name in PLAYABLE_PAGES if not read(name)]
    require(category, "27 个可玩页面齐全", len(PLAYABLE_PAGES) == 27 and not missing_pages,
            "缺失: " + compact_names(missing_pages))


def check_canonical() -> None:
    category = "Canonical"
    source = read("hansen_canonical_progress.js")
    block_match = re.search(r"var\s+defs\s*=\s*\[(.*?)\n\s*\];", source, re.S)
    defs = re.findall(r"\['([a-z]+)'\s*,\s*'[^']+'\s*,\s*(\d+)\]",
                      block_match.group(1) if block_match else "")
    sizes = {name: int(size) for name, size in defs}
    regular_total = sum(v for k, v in sizes.items() if k != "season")
    require(category, "19 岛定义、712+240=952 唯一词槽",
            len(defs) == 19 and len(sizes) == 19 and regular_total == 712
            and sizes.get("season") == 240 and sum(sizes.values()) == 952,
            f"解析到 {len(defs)} 岛；regular={regular_total}, "
            f"season={sizes.get('season')}, total={sum(sizes.values())}")
    tokens = (
        "var VERSION = 941", "hansen_canonical_progress_v941",
        "var MASTER_HITS = 3", "for(var li=1;li<=8;li++)",
        "addAlias(a,'season',off,30,landKey)",
        "REGULAR_WORDS:REGULAR_WORDS", "STAR_SEA_WORDS:STAR_SEA_WORDS",
        "TOTAL_WORDS:TOTAL_WORDS", "totalMastered:totalMastered",
        "hansen_canonical_migrated_v941", "mergeState(store",
    )
    missing = missing_tokens(source, tokens)
    require(category, "Land/Season 别名、幂等迁移与公开计数 API", not missing,
            "缺少标记: " + compact_names(missing))

    script = "hansen_canonical_progress.js"
    bad_load: list[str] = []
    bad_order: list[str] = []
    consumers = (
        "hansen_totals_wallet.js", "hansen_spellbee_gems.js",
        "hansen_island_upgrade.js", "hansen_crystal.js", "hansen_pet_showcase.js",
    )
    for page in PLAYABLE_PAGES:
        html = read(page)
        canonical_positions = script_positions(html, script)
        count = len(canonical_positions)
        if count != 1:
            bad_load.append(f"{page}×{count}")
            continue
        canonical_at = canonical_positions[0]
        positions = [pos for item in consumers for pos in script_positions(html, item)]
        if positions and canonical_at > min(positions):
            bad_order.append(page)
    require(category, "27/27 页面各装载一次 canonical 脚本", not bad_load,
            compact_names(bad_load))
    require(category, "canonical 早于所有进度/经济消费模块", not bad_order,
            compact_names(bad_order))
    template = read("template.html")
    require(category, "生成模板锁定 v960 资源戳与 canonical 装载",
            len(script_positions(template, script)) == 1 and "hansen_canonical_progress.js?v=1095" in template,
            f"template count={len(script_positions(template, script))}")

    focus_script = "hansen_focused_typing_v946.js"
    focus_pages = ("template.html",) + PLAYABLE_PAGES
    bad_focus = []
    for page in focus_pages:
        html = read(page)
        focus_positions = script_positions(html, focus_script)
        pet_positions = script_positions(html, "hansen_pet_showcase.js")
        explore_positions = script_positions(html, "hansen_explore_progress_v945.js")
        if (len(focus_positions) != 1 or len(pet_positions) != 1
                or len(explore_positions) != 1
                or not (pet_positions[0] < focus_positions[0] < explore_positions[0])):
            bad_focus.append(page)
    require(category, "模板与27个可玩页按顺序接入定向打字大师",
            len(focus_pages) == 28 and not bad_focus,
            compact_names(bad_focus))
    require(category, "Service Worker Shell 预缓存定向打字大师",
            "'./hansen_focused_typing_v946.js'" in read("sw_v944.js"),
            "sw_v944.js 缺少 hansen_focused_typing_v946.js")
    bad_hf1 = []
    for page in focus_pages:
        html = read(page)
        for tag in ("hansen_pet_showcase.js?v=1095", "hansen_cards.js?v=1095",
                    "hansen_quest_global.js?v=1095", "hansen_island_upgrade.js?v=1095"):
            if html.count(tag) != 1:
                bad_hf1.append(f"{page}:{tag}")
    require(category, "宠物与Boss卡牌存档自愈脚本使用当前精确资源戳",
            not bad_hf1, compact_names(bad_hf1))


def check_answer_and_quests() -> None:
    category = "金币/任务"
    upgrade = read("hansen_island_upgrade.js")
    coin_wallet = read("hansen_coin_wallet.js")
    answer_tokens = (
        "DAILY_CAP=2000, PER_WORD_CAP=3", "hansen_answer_coin_words_v942",
        "HansenCanonical.slotId(HansenCanonical.currentRef(),wordIdx)",
        "hsn_ans_coin_today", "HansenCoins.award", "ANSWER_PENDING_KEY",
    )
    missing = missing_tokens(upgrade, answer_tokens)
    earn_start = upgrade.find("window.earnCoinOnCorrect = function(wordIdx)")
    earn_end = upgrade.find("// 页面重载时不等下一道题", earn_start)
    earn = upgrade[earn_start:earn_end] if earn_start >= 0 and earn_end > earn_start else ""
    pending_at = earn.find("localStorage.setItem(ANSWER_PENDING_KEY")
    award_at = earn.find("if(!awardAnswer(pending))")
    ledger_at = earn.find("writeAnswerCoinLedger(ledger)", award_at)
    require(category, "答题金币采用 canonical 每词3次/全局2000事务日账", not missing,
            "缺少标记: " + compact_names(missing))
    require(category, "答题金币先写pending、幂等发币、再提交额度账本",
            0 <= pending_at < award_at < ledger_at,
            f"pending={pending_at}, award={award_at}, ledger={ledger_at}")
    require(category, "300启动金币使用永久source且flag失败可重试",
            has_all(coin_wallet, "HansenCoins.award('starter:global',300)",
                    "hansen_starter_coins_given", "seedAwards(['starter:global'])"),
            "starter:global/flag/seed 链不完整")

    quest = read("hansen_quest_global.js")
    quest_tokens = (
        "hansen_global_daily_quests_v941", "var VERSION = 942",
        "hansen-v941-quests:", "raw.list.length !== 7",
        "latest.list[j].claimed = true", "latest.allDay = latest.day",
        "Math.max(20, Math.round((+q.reward.xp || 0) * 0.6 / 5) * 5)",
        "100 + Math.min(streak(), 7) * 20", "boostAward('quest:'",
        "window.HansenCheckin", "effects().xpAward", "hansen_quest_claim_pending_v942",
    )
    missing = missing_tokens(quest, quest_tokens)
    claim = function_slice(quest, "function claim(index)")
    tx_at = claim.find("if (!writeTx(tx))")
    settle_at = claim.find("return settleTx(tx)", tx_at)
    settle = function_slice(quest, "function settleTx(tx)")
    coin_at = settle.find("awardCoin(base + ':coins'")
    xp_at = settle.find("effects().xpAward(base + ':xp'", coin_at)
    persist_at = settle.find("if (!persist(latest))", xp_at)
    require(category, "全局7任务日期确定、全清奖励读全局连签", not missing,
            "缺少标记: " + compact_names(missing))
    require(category, "任务先写领取事务、幂等奖励确认后再提交claimed/allDay",
            0 <= tx_at < settle_at and 0 <= coin_at < xp_at < persist_at,
            f"tx={tx_at}, settle={settle_at}, coin={coin_at}, xp={xp_at}, persist={persist_at}")

    bad = []
    for page in PLAYABLE_PAGES:
        count = len(script_positions(read(page), "hansen_quest_global.js"))
        if count != 1:
            bad.append(f"{page}×{count}")
    require(category, "27/27 页面各装载一次全局任务脚本", not bad,
            compact_names(bad))
    require(category, "模板锁定全局任务脚本",
            len(script_positions(read("template.html"), "hansen_quest_global.js")) == 1,
            f"template count={len(script_positions(read('template.html'), 'hansen_quest_global.js'))}")


def check_spellbee() -> None:
    category = "Spelling Bee"
    bee = read("spelling_bee.html")
    parent = read("hansen_spellbee.js")
    gems = read("hansen_spellbee_gems.js")

    cap_tokens = (
        "SB_STREAK_BONUS_CAP=5, SB_DAILY_COIN_CAP=2000",
        "hsn_sb_coin_day", "hsn_sb_coin_today", "hansen_sb_cap_tx_v942",
        "function sbCapTransaction()", "function sbRecoverCapTransaction()",
        "function sbQueueCappedReward(want,xp,kind)",
        "target!==t.before+t.coins", "t.target>SB_DAILY_COIN_CAP",
        "Math.min(want,Math.max(0,SB_DAILY_COIN_CAP-now))",
        "localStorage.setItem(SB_CAP_TX_KEY,raw)",
    )
    missing = missing_tokens(bee, cap_tokens)
    cap_start = bee.find("var SB_STREAK_BONUS_CAP=5")
    cap_end = bee.find("var _advTimer", cap_start)
    cap_source = bee[cap_start:cap_end] if cap_start >= 0 and cap_end > cap_start else ""
    queue_start = bee.find("function sbQueueCappedReward(want,xp,kind)")
    queue_end = bee.find("function sbRewardAck", queue_start)
    queue_source = bee[queue_start:queue_end] if queue_start >= 0 and queue_end > queue_start else ""
    journal_at = queue_source.find("localStorage.setItem(SB_CAP_TX_KEY,raw)")
    recover_at = queue_source.find("if(!sbRecoverCapTransaction())return null", journal_at)
    flush_at = queue_source.find("sbFlushRewardPending()", recover_at)
    require(category, "Bee 独立2000日账并以 cap journal 原子 clamp", not missing,
            "缺少标记: " + compact_names(missing))
    require(category, "Bee 先落 cap journal，再恢复额度/receipt，最后发送父页",
            0 <= journal_at < recover_at < flush_at,
            f"journal={journal_at}, recover={recover_at}, flush={flush_at}")
    require(category, "Bee 限额不读取全局钱包", bool(cap_source)
            and "HansenCoins" not in cap_source and "hansen_wallet" not in cap_source,
            "Bee cap 区段为空或出现全局钱包引用")

    parent_tokens = (
        "var activeFrame = null", "var activeFocus = null",
        "e.source !== activeFrame.contentWindow", "function openFocused(index)",
        "hansen_sb_focus_pending_v946", "function focusRule(cpm)",
        "cpm>=80?{tier:'advanced',required:5}",
        "cpm>=50?{tier:'intermediate',required:7}",
        "function focusReceipt(d)", "d.type!=='hsn_sb_focus_complete'",
        "d.sessionId!==activeFocus.sessionId", "sameFocusProof(stored,d)",
        "function settleFocus(r,target)", "api.run('crystal',r.index,meta",
        "out.consumed!==true", "hsn_sb_focus_ack",
        "d.type === 'hsn_sb_mastery'", "d.type !== 'hsn_sb_reward'",
        "Math.floor(c)!==c", "c<1 || c>20", "Math.floor(x)!==x", "x<0 || x>6",
        "hansen_sb_reward_pending_v942", "HansenCoins.award",
        "HansenRewardEffectsV942.xpAward", "hsn_sb_reward_ack",
    )
    missing = missing_tokens(parent, parent_tokens)
    require(category, "父页校验 active iframe、focused session、词位、速度与奖励 payload", not missing,
            "缺少标记: " + compact_names(missing))
    focus_start = parent.find("function focusReceipt(d)")
    settle_start = parent.find("function settleFocus(r,target)", focus_start)
    handler_at = parent.find("window.addEventListener('message'", settle_start)
    focus_source = parent[focus_start:settle_start] if focus_start >= 0 and settle_start > focus_start else ""
    settle_source = parent[settle_start:handler_at] if settle_start >= 0 and handler_at > settle_start else ""
    rule_at = focus_source.find("var rule=focusRule(d.cpm)")
    pending_at = focus_source.find("var pending=sbObject(SB_FOCUS_PENDING_KEY)", rule_at)
    proof_at = focus_source.find("sameFocusProof(stored,d)", pending_at)
    run_at = settle_source.find("api.run('crystal',r.index,meta")
    mark_at = settle_source.find("window.markAnswer(r.index,true)", run_at)
    consumed_at = settle_source.find("out.consumed!==true", mark_at)
    ack_at = settle_source.find("hsn_sb_focus_ack", consumed_at)
    require(category, "focused Bee 严格执行阈值复验→pending逐字段匹配→一次性proof→mark→ACK",
            0 <= rule_at < pending_at < proof_at and 0 <= run_at < mark_at < consumed_at < ack_at,
            f"rule={rule_at}, pending={pending_at}, proof={proof_at}, run={run_at}, "
            f"mark={mark_at}, consumed={consumed_at}, ack={ack_at}")
    require(category, "普通 Bee 不再调用旧新词钻石链；遗留 mastery 仅严格 ACK 清理",
            "HansenSpellbeeGems.prepare(" not in parent
            and "HansenSpellbeeGems.begin(" not in parent
            and "HansenSpellbeeGems.commit(" not in parent
            and "sbAck(e.source,masteryReceipt.rewardId)" in parent,
            "父页仍调用旧 Bee 新词钻石链，或缺遗留 pending 清理")
    require(category, "父页禁止恢复无 receipt 的旧 record(snapshot) 入口",
            "HansenSpellbeeGems.record(snapshot)" not in parent,
            "发现无 receipt 的 record(snapshot) 调用")

    gem_tokens = (
        "var STATE_VERSION = 942", "receipts:{}", "function validReceiptId(id, day)",
        "function validateStoredReceipt(id,r)", "function canonicalAdvanced(r)",
        "function begin(snapshot, receipt)", "function commit(receiptId)",
        "var TIERS = [{n:5,gem:1},{n:10,gem:2},{n:20,gem:5}]",
        "window.HansenCanonical", "c.slotId(ref,idx)",
        "newBefore:!crystal", "var eligible=snapshot.newBefore===true",
        "r.eligible&&r.status==='committed'&&canonicalAdvanced(r)",
        "r.fingerprint!==fingerprint(r)", "if(!save(s))",
        "window.HansenGems", "grantedTiers", "s.version!==STATE_VERSION",
    )
    missing = missing_tokens(gems, gem_tokens)
    begin_start = gems.find("function begin(snapshot, receipt)")
    commit_start = gems.find("function commit(receiptId)", begin_start)
    begin_source = gems[begin_start:commit_start] if begin_start >= 0 and commit_start > begin_start else ""
    prepared_at = begin_source.find("status:'prepared'")
    prepare_save_at = begin_source.find("if(!save(s))", prepared_at)
    commit_end = gems.find("function record", commit_start)
    commit_source = gems[commit_start:commit_end] if commit_start >= 0 and commit_end > commit_start else ""
    confirmed_at = commit_source.find("if(!canonicalAdvanced(r))")
    committed_at = commit_source.find("r.status='committed'", confirmed_at)
    commit_save_at = commit_source.find("if(!save(s))", committed_at)
    reconcile_at = commit_source.find("reconcile(s)", commit_save_at)
    require(category, "旧版 Bee 5/10/20 钻石账本保持可校验，仅用于历史兼容", not missing,
            "缺少标记: " + compact_names(missing))
    require(category, "旧版 Bee receipt 历史账本仍保持 prepared→canonical→commit 完整性",
            0 <= prepared_at < prepare_save_at and 0 <= confirmed_at < committed_at < commit_save_at < reconcile_at,
            f"prepared={prepared_at}, prepareSave={prepare_save_at}, confirmed={confirmed_at}, "
            f"committed={committed_at}, commitSave={commit_save_at}, reconcile={reconcile_at}")


def check_checkin_and_addiction() -> None:
    category = "签到/留存"
    bad_22: list[str] = []
    bad_closed: list[str] = []
    bad_transaction: list[str] = []
    for page in PLAYABLE_PAGES:
        html = read(page)
        if "×2.2 (封顶)" not in html or "Math.min(S.streak-1,6)" not in html:
            bad_22.append(page)
        body = function_slice(html, "function doOpenChest()")
        if not has_all(body, "chosen.max-chosen.min+1", "Math.random()*21"):
            bad_closed.append(page)
        bounds_at = body.find("var __checkinCoinMax=880,__checkinXPMax=440")
        claim_at = body.find("HansenCheckin.claimReward({day:today(),coin:chosen.amount,xp:__checkinXP,tag:__huTag})")
        timer_at = body.find("setTimeout(function()", claim_at)
        if not (0 <= bounds_at < claim_at < timer_at) or "addCoin(chosen.amount)" in body or "addXP(__checkinXP)" in body:
            bad_transaction.append(page)
    require(category, "27/27 页面第7天起签到倍率为2.2封顶", not bad_22,
            compact_names(bad_22))
    require(category, "签到金币上限与40 XP均使用闭区间随机", not bad_closed,
            compact_names(bad_closed))
    require(category, "27/27 签到先验 880/440 边界并走全局 receipt，动画最后执行", not bad_transaction,
            compact_names(bad_transaction))

    checkin = read("hansen_checkin_global.js")
    checkin_tokens = (
        "hansen_checkin_last", "hansen_checkin_streak",
        "hansen_checkin_streak_day", "hansen_checkin_streak_pending_v942",
        "MAX_RECEIPT_COIN=880,MAX_RECEIPT_XP=440",
        "function claimedToday()", "function markClaimed(day)",
        "function readReceiptState(day)",
        "validPositiveInt(r.coin,MAX_RECEIPT_COIN)",
        "validPositiveInt(r.xp,MAX_RECEIPT_XP)",
        "function validStreakPlan(p)", "p.targetStreak===expected",
        "function recoverStreakPending()", "r.committed=true",
        "if(!markClaimed(day))", "getReceipt: getReceipt", "window.HansenCheckin",
    )
    missing = missing_tokens(checkin, checkin_tokens)
    require(category, "签到全局日闸门、严格 receipt 与双键连签 journal", not missing,
            "缺少标记: " + compact_names(missing))

    addiction = read("hansen_addiction.js")
    milestone_block = re.search(r"var\s+MILESTONES\s*=\s*\[(.*?)\n\s*\];", addiction, re.S)
    milestone_text = milestone_block.group(1) if milestone_block else ""
    rows = re.findall(
        r"days:(\d+).*?coin:(\d+),\s*boost:(\d+)(?:,\s*buff:'([^']+)',\s*buffDays:(\d+))?",
        milestone_text,
    )
    expected = [
        ("14", "120", "120", "", ""),
        ("30", "250", "240", "xp2x", "3"),
        ("100", "600", "480", "", ""),
    ]
    require(category, "里程碑只保留14/30/100真实权益", rows == expected,
            f"解析结果: {rows}")
    require(category, "里程碑读取全局签到连续天数",
            has_all(addiction, "function currentGlobalStreak()", "HansenCheckin.getStreak",
                    "var streak = currentGlobalStreak()"),
            "未发现 HansenCheckin → milestone 链路")

    theme_match = re.search(r"var\s+WEEKLY_THEMES\s*=\s*\[(.*?)\n\s*\];", addiction, re.S)
    theme_keys = re.findall(r"key:'([^']+)'", theme_match.group(1) if theme_match else "")
    expected_themes = [
        "wordIslandFood", "wordIslandAnimal", "wordIslandColorNum",
        "wordIslandPeople", "wordIslandSports", "wordIslandFamily",
        "wordIslandSchool", "wordIslandHouse", "wordIslandClothes",
        "wordIslandNature", "wordIslandTransport", "wordIslandTime",
        "wordIslandBody", "wordIslandPronouns", "wordIslandVerbs",
        "wordIslandAdj", "wordIslandCity", "wordIslandMisc",
    ]
    require(category, "每周主题精确覆盖18个常规岛", theme_keys == expected_themes,
            f"解析到 {len(theme_keys)} 项: {compact_names(theme_keys)}")

    authority_tokens = (
        "function effectTarget(createdAt,base,duration)", "Math.max(createdAt,base)+duration",
        "b.target!==bt||x.target!==xt", "if(cur.value===tx.boost.base)",
        "else if(cur.value!==tx.boost.target)return false",
        "if(cur.value===tx.xp2x.base)", "else if(cur.value!==tx.xp2x.target)return false",
        "function officialCheckinReceipt(value)", "HansenCheckin.getReceipt(requested.day)",
        "function readPieces()", "target!==base+amount", "if(has)return null",
        "if(p.value===tx.pet.base)", "else if(p.value!==tx.pet.target)return false",
    )
    missing = missing_tokens(addiction, authority_tokens)
    require(category, "里程碑和宝箱只接受权威 base→target，损坏/第三余额 fail-closed", not missing,
            "缺少标记: " + compact_names(missing))

    rarity_tokens = (
        "return r<0.02?'legendary':(r<0.10?'epic':(r<0.30?'rare':'common'))",
        "extraCoin:5,petPiece:0", "extraCoin:15,petPiece:0", "extraCoin:50,petPiece:1",
        "hansen_pet_pieces", "origDoOpenChest.apply(this,arguments)",
        "var receipt=officialCheckinReceipt(value);if(!receipt)return false",
    )
    missing = missing_tokens(addiction, rarity_tokens)
    original_at = addiction.find("origDoOpenChest.apply(this,arguments)")
    official_at = addiction.find("officialCheckinReceipt(result)", original_at)
    settle_at = addiction.find("settleChestReceipt(receipt)", official_at)
    banner_at = addiction.find("showChestRarityBanner(rc)", settle_at)
    require(category, "宝箱稀有度70/20/8/2与0/5/15/50+1碎片真实落地", not missing,
            "缺少标记: " + compact_names(missing))
    require(category, "宝箱先取得正式签到 receipt，再结算稀有奖励，最后展示",
            0 <= original_at < official_at < settle_at < banner_at,
            f"base={original_at}, official={official_at}, settle={settle_at}, banner={banner_at}")


def check_boss_and_season() -> None:
    category = "Boss/星海"
    reward = read("hansen_round_reward.js")
    tokens = (
        "function isSeason(k){ return k==='season'; }",
        "function isLand(k){ return /^land[1-8]$/.test(k||''); }",
        "for(var i=1;i<=8;i++)",
        "hsn_landmap_cleared_", "(lv|0)!==6",
        "seasonLandClears().length!==8", "hansen_season_final_reward_v941",
        "hansen_season_pillar_gems", "count===6?100:count*15",
        "finalBenefitsAlreadyPaid:!!valid[6]",
        "SEASON_GEMS-legacy.credited",
        "legacy.finalBenefitsAlreadyPaid?0:REWARD_COIN",
        "legacy.finalBenefitsAlreadyPaid?0:REWARD_BOOST",
        "window.BOSSES.length",
        "mode==='land'?'通关本 Land '+meta.total+' 关 Boss！'",
        "8 个 Land 真实通关 + Lv6 赛尔娅胜利已核验",
    )
    missing = missing_tokens(reward, tokens)
    require(category, "Season只认8旗+实际Lv6，legacy仅补差", not missing,
            "缺少标记: " + compact_names(missing))
    ledger_at = reward.find("localStorage.setItem(SEASON_FINAL_KEY,JSON.stringify(ledger))")
    award_positions = [
        reward.find("addCoins(coins)", ledger_at), reward.find("addBoost(boost)", ledger_at),
        reward.find("addGems(gems)", ledger_at),
    ]
    require(category, "Season一次性凭证先写入再发三类奖励",
            ledger_at >= 0 and all(pos > ledger_at for pos in award_positions),
            f"ledger={ledger_at}, awards={award_positions}")
    # HF6: 普通岛/Land 的奖励资格只来自每岛独立、逐轮去重的 state。
    # 永久卡牌通关记录与 landN_prog 只能负责解锁，绝不能再次成为发奖证明。
    hf6_tokens = (
        "STATE_PREFIX = 'hansen_boss_round_state_v946_'",
        "function validState(x)", "x.roundNo!==x.completedCount+1",
        "function stateResult()", "function recordRoundWin(lv)",
        "if(merged.indexOf(lv)>=0)return {ok:true,duplicate:true,state:s}",
        "function txStatus()", "function makeTx(winLv,state)",
        "function recoverFullStateWithoutTx(show)",
        "if(status.absent)return recoverFullStateWithoutTx(show)",
        "if(!isFull(r.state.cleared,r.state.total))return true",
        "receiptId:'round:v946:'+state.mode+':'+k+':r'+state.roundNo",
        "function sourceBase(tx)", ":tx.receiptId;",
        "roundNo:tx.roundNo+1", "completedCount:tx.roundNo", "cleared:[]",
        "Boss 本轮进度存档异常，奖励已暂停；原始数据已保留",
        "Boss 奖励恢复凭据异常，奖励已暂停；原始数据已保留",
    )
    hf6_missing = missing_tokens(reward, hf6_tokens)
    historical_reads = [token for token in (
        "window.getIslandClearedLevels()", "localStorage.getItem(k+'_prog')",
    ) if token in reward]
    require(category, "HF6普通/Land只认独立逐轮state，历史解锁记录不得参与发奖；满轮无pending可恢复",
            not hf6_missing and not historical_reads,
            "缺少标记: " + compact_names(hf6_missing)
            + ("；发现历史进度读取: " + compact_names(historical_reads)
               if historical_reads else ""))

    modern_win = function_slice(reward, "function onWinModern(lv)")
    record_win = modern_win.find("recordRoundWin(lv)")
    tx_prepare = modern_win.find("writeJson(txKey(),tx)")
    tx_settle = modern_win.find("return settleTx(tx,true)", tx_prepare)
    settle = function_slice(reward, "function settleTx(tx,show)")
    coin_award = settle.find("walletAward(window.HansenCoins")
    gem_award = settle.find("walletAward(window.HansenGems", coin_award)
    boost_award = settle.find("effects().boostAward", gem_award)
    finalize = settle.find("finalizePaid(tx,a)", boost_award)
    finalize_block = function_slice(reward, "function finalizePaid(tx,a)")
    require(category, "常规/Land逐关落state，满轮建事务，三钱包后原子推进roundNo/receipt",
            0 <= record_win < tx_prepare < tx_settle
            and 0 <= coin_award < gem_award < boost_award < finalize
            and has_all(
                reward, "REWARD_COIN = 300", "REWARD_BOOST = 120",
                "? SEASON_GEMS : 88", "function actualRegularWinLv()",
                "if(!win.ok||!isFull(win.state.cleared,win.state.total))return false",
                "BOSSES[i]===bossCurrent", "S.bossCurrentLv",
            )
            and has_all(finalize_block, "lastReceipt:{id:tx.receiptId",
                        "roundNo:tx.roundNo+1", "completedCount:tx.roundNo", "cleared:[]")
            and "S.level" not in function_slice(reward, "function actualRegularWinLv()"),
            f"record={record_win}, prepare={tx_prepare}, settle={tx_settle}, "
            f"coin={coin_award}, gem={gem_award}, boost={boost_award}, finalize={finalize}")

    bad_keys: list[str] = []
    for i in range(1, 9):
        page = f"island_land{i}.html"
        html = read(page)
        if not has_all(
            html,
            "match(/island_land([1-8])\\.html/)",
            "bossWinKey='land'+_landBossMatch[1]+':b'+bossLv",
            "(window._s1Idx|0)+1",
        ):
            bad_keys.append(page)
    require(category, "8个Land首胜键使用 landN:b本地Boss序号", not bad_keys,
            compact_names(bad_keys))

    active_sources = [read("template.html"), read("hansen_round_bar.js")] + [read(p) for p in PLAYABLE_PAGES]
    require(category, "运行时已移除旧六柱表现层",
            all("__seasonPillarsLit" not in source for source in active_sources),
            "仍发现 __seasonPillarsLit")

    cards = read("hansen_cards.js")
    card_record = function_slice(cards, "function markBossWin(lv)")
    forbidden_awards = (
        "addGem(", "addXP(", "addCoin(", "HansenCoins", "HansenGems",
        "grantBoost(", "HansenBoost",
    )
    require(category, "旧Boss卡牌记录模块不再暗发金币/XP/钻石/强化",
            bool(card_record) and not any(token in card_record for token in forbidden_awards),
            "markBossWin 仍出现经济发奖调用或函数未找到")
    require(category, "卡牌进度只认实际Boss关号且绝不回退玩家S.level",
            has_all(cards, "function resolveActualBossLv()", "window._hansenRebattleLv",
                    "window._s1Idx", "BOSSES[i] === bossCurrent", "S.bossCurrentLv",
                    "var lv = resolveActualBossLv()")
            and "window.S && window.S.level" not in cards,
            "真实关号解析链不完整或仍引用 S.level")

    season = read("hansen_season.js")
    season_forbidden = (
        "checkMilestones", "origMA", "answerCorrect", "bossWin",
        "HansenCoins", "HansenGems", "HansenBoost", "window.addCoin",
        "addXP(", "addGem(", "grantBoost(", "hsn_season_answer_day",
    )
    require(category, "旧赛季积分永久只读且无200/500暗奖入口",
            has_all(season, "function addSeasonPoints(){ return false; }",
                    "pointsReadOnly: true", "nextMilestone: function(){ return null; }")
            and not any(token in season for token in season_forbidden),
            "发现旧积分增长、里程碑或经济发奖入口")


def check_crystal_and_pet() -> None:
    category = "钻石/宠物"
    crystal = read("hansen_crystal.js")
    crystal_tokens = (
        "var MAX_LV    = 5", "var STAR_NEED = 2", "var GEM_PER_WORD = 4",
        "var BOOST_STAR = 2", "var ISLAND_BONUS = 50",
        "{n:'熟练探险家', need:30,  bonus:20}",
        "{n:'高手探险家', need:100, bonus:40}",
        "{n:'大师探险家', need:250, bonus:80}",
        "{n:'大神探险家', need:500, bonus:150}",
        "{n:'传奇探险家', need:800, bonus:300}",
        "window.HansenCanonical", "h.toCanonicalIndex", "h.fromCanonicalIndex",
        "hsn_crystal_isldone_", "reconcileCanonicalRewards",
        "w.d !== t", "isBoosted() ? BOOST_STAR : 1",
    )
    missing = missing_tokens(crystal, crystal_tokens)
    require(category, "结晶5星/每星2次/每日锁星/强化2星/每词4钻", not missing,
            "缺少标记: " + compact_names(missing))
    require(category, "结晶按19 canonical岛发一次50钻并迁移对账",
            has_all(crystal, "h.islands.forEach", "canonicalDoneTotal()",
                    "hansen_crystal_migrated_v941", "ISLAND_BONUS"),
            "canonical 全岛奖励/迁移标记不完整")

    pet = read("hansen_pet_showcase.js")
    pet_tokens = (
        "36阶·全岛共享", "var PET_XP_CAP=15000", "var MASTER_HITS=3",
        "HansenCanonical.TOTAL_WORDS)||952", "wordIslandLand1", "wordIslandLand8",
        "if(/_bak$|_backup$|_tmp$/i.test(k)) continue",
        "Math.floor(Math.max(ox,ot))", "hansen_wallet_charxp", "function globalXP()",
        "HansenCanonical.absorbCurrent()", "HansenCanonical.totalMastered(MASTER_HITS)",
        "function xpReq(i)", "function masterReq(i)",
        "if(x>=xpReq(i)&&m>=masterReq(i))",
        "window.__hsnRefreshPetUI",
    )
    missing = missing_tokens(pet, pet_tokens)
    require(category, "宠物36阶采用全局XP+952 canonical掌握双门槛", not missing,
            "缺少标记: " + compact_names(missing))
    pet_bad = [
        page for page in PLAYABLE_PAGES
        if not has_all(read(page), "function petTaskComplete(", "addXP(petXp)",
                       "window.__hsnRefreshPetUI")
    ]
    require(category, "27/27 页面玩法奖励同步进入宠物XP", not pet_bad,
            compact_names(pet_bad))

    land_mode_bad: list[str] = []
    for i in range(1, 9):
        page = f"island_land{i}.html"
        html = read(page)
        required_mode_tokens = (
            "const TYPING_LEVELS={", "xpPerWord:5,gemBonus:12,petXp:25",
            "xpPerWord:10,gemBonus:25,petXp:40",
            "xpPerWord:18,gemBonus:50,petXp:70",
            "const CLOZE_LEVELS={", "xpPerQ:5,gemBonus:15,petXp:30",
            "xpPerQ:8,gemBonus:25,petXp:45",
            "xpPerQ:14,gemBonus:40,petXp:65",
            "words:allW.filter(w=>w.en.length<=7).map(w=>w.en)",
            "words:allW.filter(w=>w.en.length>7&&w.en.length<=8).map(w=>w.en)",
            "words:allW.filter(w=>w.en.length>8).map(w=>w.en)",
            "addXP(L.xpPerWord)", "addXP(L.xpPerQ)",
            "petTaskComplete('⌨️ 打字大师 '+L.name,L.petXp,'type')",
            "petTaskComplete('📝 完形填空 '+L.name,L.petXp,'cloze')",
        )
        if not has_all(html, *required_mode_tokens):
            land_mode_bad.append(page)
    require(category, "8个Land打字/完形字段完整且各用本页30词动态分档",
            not land_mode_bad, compact_names(land_mode_bad))


def check_guide() -> None:
    category = "设置说明"
    guide = read("hansen_econ_guide.js")
    card_ids = re.findall(r"(?:=|\+)\s*card\('([^']+)'", guide)
    require(category, "设置中恰好四张金币/钻石/宠物升级/宠物经验卡",
            card_ids == ["Coin", "Diamond", "Pet", "PetExp"],
            f"解析到 card IDs: {card_ids}")
    require(category, "四卡默认折叠且具有ARIA按钮语义",
            has_all(guide, "<button", "aria-expanded=", "aria-controls=", "hidden")
            and ("aria-expanded=\"false\"" in guide or "aria-expanded='false'" in guide),
            "需要 button + aria-expanded=false + aria-controls + hidden")
    titles = ("金币怎么得", "钻石怎么得", "宠物怎么升级", "宠物经验怎么得")
    require(category, "四张标题全部使用简短中文", has_all(guide, *titles),
            "缺少标题: " + compact_names(missing_tokens(guide, titles)))

    facts = (
        "得到 300 金币", "每题得到 1 金币", "同一单词每天最多 3 次",
        "每项 20～120 金币", "每天得到 10～930 金币", "每赢一词得 3～15",
        "得到 4 钻石", "得到 50 钻石", "88 钻石", "得到 100 钻石",
        "经验要够，已掌握单词也要够", "任选 3 个未掌握单词",
        "经验和单词全部保留", "学会一个新单词", "得到 10 经验",
        "答对每题得 5 经验", "每项得到 20～200 经验",
    )
    missing = missing_tokens(guide, facts)
    require(category, "四份速查锁定当前核心奖励和升级规则", not missing,
            "缺少标记: " + compact_names(missing))

    constants = guide[guide.find("var COIN_HTML"):guide.find("function bindGuide")]
    visible_parts = []
    for literal in re.findall(r"'([^']*)'", constants):
        text = re.sub(r"<[^>]*>", "", literal)
        if text.strip():
            visible_parts.append(text.strip())
    visible = "\n".join(visible_parts)
    require(category, "玩家文案除用户指定名称 Boss 外不含英文、开发术语或旧版本说明",
            not re.search(r"[A-Za-z]", visible.replace("Boss", ""))
            and not re.search(r"旧版|老版本|历史字段|已停用|账本|收据|接口|变量", visible),
            "发现不应展示的内容")
    long_parts = [part for part in visible_parts if len(part) > 45]
    require(category, "每条说明最多45字且总量精简",
            not long_parts and len(visible) <= 1200,
            "过长条目=" + compact_names(long_parts) + f"；总字符={len(visible)}")
    require(category, "手机说明不再使用横向大表格",
            "hsn-eg-table" not in guide and "min-width:620px" not in guide,
            "发现旧横向表格")
    require(category, "亮色主题标题/提示/奖励均有深色文字规则",
            has_all(guide, "html.hsn-pal-light .hsn-eg-title",
                    "html.hsn-pal-light .hsn-eg-sub",
                    "html.hsn-pal-light .hsn-eg-get"),
            "亮色可读性规则不完整")

    guide_tag = 'src="hansen_econ_guide.js?v=1095"'
    guide_pages = ("template.html",) + PLAYABLE_PAGES
    wiring_bad = [name for name in guide_pages if read(name).count(guide_tag) != 1]
    require(category, "模板与27页唯一接入HF7高对比逐轮规则速查", not wiring_bad,
            compact_names(wiring_bad))

    # The old inline guide had no hsnCoinGuide id, so guard its exact heading too.
    legacy_pages = [
        name for name in ("template.html",) + PLAYABLE_PAGES
        if "💰 金币说明书</h3>" in read(name)
    ]
    require(category, "模板与27页已删除旧版内联金币说明", not legacy_pages,
            compact_names(legacy_pages))


def check_release_contract() -> None:
    category = "发布"
    package = read("package_release.py")
    build = read("build.py")
    workflow = read(".github/workflows/jarvis-three-file-release.yml")
    readme = read("README.md")

    package_tokens = (
        "单词大冒险_v{version}_可直接部署.zip",
        "单词大冒险_v{version}_含贾维斯完整源码.zip",
        'README_ASSET = "README.md"',
        "DEPLOY_ALLOWED_EXT = {", "DEPLOY_RUNTIME_HTML = {",
        'SOURCE_EXCLUDE_EXT = {".zip", ".pyc"}',
        '"sw_v944.js", "manifest.webmanifest", "VERSION", MANIFEST_NAME',
        "SOURCE_REQUIRED_FILES = {", '"evolution_dashboard.html"',
        "SECRET_PATTERNS", "ZIP_DATE_TIME", "SHA256SUMS", "unexpected = sorted(",
        "actual_names != expected_names", "requested v{version}",
        "archive.testzip()", "output must contain exactly two ZIPs and README.md",
        "exactly 2 reproducible ZIPs + README.md",
        '"test_theme_scroll_v944.mjs"',
        '"test_sw_upgrade_v944.mjs"',
        '"hansen_explore_progress_v945.js"',
        '"test_explore_progress_api_v945.mjs"',
        '"test_explore_dual_progress_v945.mjs"',
        '"test_explore_template_v945.mjs"',
        '"test_explore_ui_v945.mjs"',
        '"hansen_focused_typing_v946.js"',
        '"test_focused_typing_v946.mjs"',
        '"test_explore_spelling_gate_v946.mjs"',
        '"test_focused_spelling_crystal_v946.mjs"',
        '"test_spelling_bee_light_theme_hf3_v946.mjs"',
        '"test_home_theme_shop_light_hf3_v946.mjs"',
        '"test_settings_guides_hf4_v946.mjs"',
        '"test_boss_timer_hf5_v946.mjs"',
        '"test_camel_color_ban_hf7_v946.mjs"',
        '"test_boss_yecha_red_lotus_v951.mjs"',
        '"test_boss_answer_contrast_v952.mjs"',
        '"test_boss_admin_entry_v953.mjs"',
        '"test_daily_card_alignment_v954.mjs"',
        '"test_land_gacha_reveal_v955.mjs"',
        '"test_food_word_icons_v956.mjs"',
        '"test_food_word_icons_v957.mjs"',
        '"apply_user_food_icons_v958.mjs"',
        '"test_food_word_icons_v958.mjs"',
        '"test_boss_naming_v959.mjs"',
        '"test_food_icon_compression_v960.mjs"',
        "_scan_forbidden_text_colors(entries)",
        "_verify_hf7_runtime_contract(entries)",
        '"_sw_upgrade_v944.html", "hansen_sw_upgrade_gate_v944.js"',
        '"hansen_backup_bootstrap_v944.js", "hansen_backup_v944.js"',
        'FORBIDDEN_RUNTIME_FILES = {"hansen_backup_bootstrap.js", "hansen_backup.js", "sw.js"}',
    )
    missing = missing_tokens(package, package_tokens)
    require(category, "打包器严格生成可部署ZIP+含贾维斯ZIP+README", not missing,
            "缺少标记: " + compact_names(missing))
    require(category, "两种ZIP排除历史ZIP且部署包只准运行白名单",
            has_all(package, '".zip"', '".git"', '"releases"',
                    "not _deploy_allowed(rel)", "source archive contains a nested ZIP"),
            "白名单或防ZIP嵌套守卫不完整")

    obsolete = [name for name in ("hansen_backup_bootstrap.js", "hansen_backup.js")
                if (ROOT / name).exists()]
    entries = [
        "index.html", "_frame.html", "boss_hall.html", "season_showcase.html",
        "spelling_bee.html", "land_map.html",
    ] + [page.name for page in sorted(ROOT.glob("island_*.html"))]
    bootstrap_tag = '<script src="hansen_backup_bootstrap_v944.js?v=1095"></script>'
    gate_open = '<script src="hansen_sw_upgrade_gate_v944.js?v=1095">'
    runtime_tag = '<script src="hansen_backup_v944.js?v=1095"></script>'
    bad_boot: list[str] = []
    old_refs: list[str] = []
    for page in entries:
        html = read(page)
        first_script = re.search(r"<script\b[^>]*>", html, re.I)
        if not first_script or first_script.group(0) != gate_open:
            bad_boot.append(page + "(升级门非首脚本)")
        boot_at = html.find(bootstrap_tag)
        storage_at = html.find("localStorage")
        if boot_at < 0 or (storage_at >= 0 and boot_at > storage_at):
            bad_boot.append(page)
        if "hansen_backup_bootstrap.js" in html or "hansen_backup.js" in html:
            old_refs.append(page)
    bad_runtime = [page.name for page in sorted(ROOT.glob("island_*.html"))
                   if runtime_tag not in read(page.name)]
    require(category, "全部入口先加载v944独立备份引导且旧运行文件清零",
            not obsolete and not bad_boot and not old_refs,
            "旧文件=" + compact_names(obsolete) + "；引导顺序=" + compact_names(bad_boot)
            + "；旧引用=" + compact_names(old_refs))
    require(category, "27/27可玩页面加载v944独立备份主脚本",
            len(bad_runtime) == 0 and len(list(ROOT.glob("island_*.html"))) == 27,
            compact_names(bad_runtime))
    sw_shell = read("sw_v944.js")
    require(category, "SW与事务构建锁定v944备份新路径",
            "'./hansen_backup_bootstrap_v944.js'" in sw_shell
            and "'./hansen_backup_bootstrap.js'" not in sw_shell
            and has_all(build, "BACKUP_BOOTSTRAP", "BACKUP_RUNTIME",
                        "OBSOLETE_BACKUP_RUNTIMES", "_assert_backup_runtime_contract(stage)"),
            "SW Shell 或 build.py 备份路径契约不完整")
    require(category, "v960运行时、Boss命名、用户食物图标、星海卡牌揭晓、三卡对齐、Boss高对比主题、HF6逐轮Boss与备份校验使用精确脚本键和全新缓存代际",
            has_all(sw_shell, "CACHE_PREFIX + 'shell-21'", "CACHE_PREFIX + 'pages-19'",
                    "CACHE_PREFIX + 'assets-19'", "CACHE_PREFIX + 'icons-3'",
                    "/\\/icons\\/(?:[^/]+\\/)*[^/]+\\.(?:webp|png|svg)$/i",
                    "'./hansen_addiction.js?v=1095'", "'./hansen_econ_guide.js?v=1095'",
                    "'./hansen_gacha.js?v=1095'", "'./hansen_land_cards.js?v=1095'",
                    "'./hansen_round_reward.js?v=1095'",
                    "'./hansen_round_bar.js?v=1095'",
                    "'./hansen_backup_v944.js?v=1095'",
                    "'./hansen_boss_lock.js?v=1095'",
                    "'./hansen_diamond_shop.js?v=1095'",
                    "'./hansen_mylearning.js?v=1095'",
                    "'./hansen_palette.js?v=1095'",
                    "'./hansen_boss_theme.js?v=1095'")
            and 'src="hansen_addiction.js?v=1095"' in read("template.html")
            and 'src="hansen_diamond_shop.js?v=1095"' in read("template.html")
            and 'src="hansen_diamond_shop.js?v=1095"' in read("index.html")
            and 'src="hansen_mylearning.js?v=1095"' in read("template.html")
            and 'src="hansen_palette.js?v=1095"' in read("template.html")
            and 'src="hansen_boss_theme.js?v=1095"' in read("template.html")
            and 'src="hansen_econ_guide.js?v=1095"' in read("template.html")
            and 'src="hansen_round_reward.js?v=1095"' in read("template.html")
            and 'src="hansen_round_bar.js?v=1095"' in read("template.html")
            and 'src="hansen_backup_v944.js?v=1095"' in read("template.html")
            and 'src="hansen_boss_lock.js?v=1095"' in read("template.html"),
            "shell/pages/assets/icons 代际、图标子目录规则或v960精确资源键不一致")
    gate = read("hansen_sw_upgrade_gate_v944.js")
    upgrade = read("_sw_upgrade_v944.html")
    require(category, "v943→v944 首载升级门阻止同名脚本混版",
            has_all(gate, "__hansenSwUpgradeGateV944", "window.stop()",
                    "_sw_upgrade_v944.html", "sw_v944.js")
            and has_all(upgrade, "controllerchange", "sw_v944.js", "safeReturn")
            and "serviceWorker.register('./sw_v944.js'" in read("index.html")
            and "serviceWorker.register('./sw.js'" not in read("index.html"),
            "早期升级门、隔离升级页或新 Worker 注册不完整")

    workflow_tokens = (
        "pull_request:", "push:", "branches: [main]", "workflow_dispatch:",
        "python economy_guard.py", "python check_resources.py", "python jarvis.py --deep",
        "node_tests=(./test_*v*.mjs)", "for test_file in",
        "python package_release.py", "test \"${#zip_files[@]}\" -eq 2",
        'test -s "$dir/README.md"',
        'test "$(find "$dir" -maxdepth 1 -type f | wc -l)" -eq 3',
        "actions/upload-artifact@v4", "publish-release:",
        "contents: write", "gh release create", "Require a new immutable VERSION",
        "Refusing to rewrite immutable release", "--draft",
        'test "$tag_sha" = "$GITHUB_SHA"', "requirements-audit.txt", "npm ci",
    )
    missing = missing_tokens(workflow, workflow_tokens)
    require(category, "GitHub工作流PR校验、main全绿发布且严格三资产", not missing,
            "缺少标记: " + compact_names(missing))
    banned = [token for token in ("force=true", "--clobber", "gh release delete-asset")
              if token in workflow]
    require(category, "GitHub Release 禁止强移标签/覆盖或删除历史资产", not banned,
            "发现危险命令: " + compact_names(banned))

    readme_tokens = (
        "## v960 的目标", "## v959 的目标", "## v958 的目标", "## 数据与存档", "经济系统", "Release 不可变性",
        "单词大冒险_v960_可直接部署.zip",
        "单词大冒险_v960_含贾维斯完整源码.zip",
        "pig-Photoroom.png", "icons/food-v958/pork.webp",
        "test_theme_motion_v943.mjs", "test_theme_runtime_v943.mjs",
        "test_theme_scroll_v944.mjs",
        "test_sw_upgrade_v944.mjs",
        "README.md", "economy_guard.py", "GitHub",
    )
    missing = missing_tokens(readme, readme_tokens)
    require(category, "README含v960图标压缩、v959命名修复、v958图标记录、恢复与三资产说明", not missing,
            "缺少标记: " + compact_names(missing))


def run_node_tests() -> None:
    category = "Node运行时"
    tests = sorted(ROOT.glob("test_*v*.mjs"), key=lambda p: p.name)
    require(category, "发现全部版本化运行时回归测试（含v960）", bool(tests),
            "没有发现 test_*v*.mjs")
    expected = {
        "test_canonical_progress_v941.mjs",
        "test_canonical_economy_v941.mjs",
        "test_quest_global_v941.mjs",
        "test_spellbee_economy_v941.mjs",
        "test_answer_coin_v941.mjs",
        "test_round_economy_v941.mjs",
        "test_land_mode_xp_v941.mjs",
        "test_legacy_economy_v941.mjs",
        "test_theme_motion_v943.mjs",
        "test_theme_runtime_v943.mjs",
        "test_theme_scroll_v944.mjs",
        "test_sw_upgrade_v944.mjs",
        "test_explore_progress_api_v945.mjs",
        "test_explore_dual_progress_v945.mjs",
        "test_explore_template_v945.mjs",
        "test_explore_ui_v945.mjs",
        "test_focused_typing_v946.mjs",
        "test_explore_spelling_gate_v946.mjs",
        "test_focused_spelling_crystal_v946.mjs",
        "test_spelling_bee_light_theme_hf3_v946.mjs",
        "test_home_theme_shop_light_hf3_v946.mjs",
        "test_settings_guides_hf4_v946.mjs",
        "test_boss_timer_hf5_v946.mjs",
        "test_boss_round_ledger_hf6_v946.mjs",
        "test_boss_round_bar_theme_hf6_v946.mjs",
        "test_camel_color_ban_hf7_v946.mjs",
        "test_boss_yecha_red_lotus_v951.mjs",
        "test_boss_answer_contrast_v952.mjs",
        "test_boss_admin_entry_v953.mjs",
        "test_daily_card_alignment_v954.mjs",
        "test_land_gacha_reveal_v955.mjs",
        "test_food_word_icons_v956.mjs",
        "test_food_word_icons_v957.mjs",
        "test_food_word_icons_v958.mjs",
        "test_boss_naming_v959.mjs",
        "test_food_icon_compression_v960.mjs",
    }
    missing_expected = sorted(expected - {p.name for p in tests})
    require(category, "canonical/经济/任务/Bee/Land/legacy核心测试齐全", not missing_expected,
            "缺失: " + compact_names(missing_expected))

    node = shutil.which("node")
    if not node:
        require(category, "Node 可执行", False, "PATH 中找不到 node")
        return
    require(category, "Node 可执行", True)
    for path in tests:
        try:
            result = subprocess.run(
                [node, path.name], cwd=ROOT, capture_output=True, text=True,
                timeout=60, check=False,
            )
            combined = "\n".join(part.strip() for part in (result.stdout, result.stderr) if part.strip())
            lines = [line.strip() for line in combined.splitlines() if line.strip()]
            TEST_OUTPUT[path.name] = lines[-1] if lines else "(无输出)"
            require(category, path.name, result.returncode == 0,
                    f"exit={result.returncode}; {TEST_OUTPUT[path.name]}")
        except subprocess.TimeoutExpired:
            TEST_OUTPUT[path.name] = "超时（60秒）"
            require(category, path.name, False, TEST_OUTPUT[path.name])
        except OSError as exc:
            TEST_OUTPUT[path.name] = str(exc)
            require(category, path.name, False, str(exc))


def run_checks() -> None:
    check_basics()
    check_canonical()
    check_answer_and_quests()
    check_spellbee()
    check_checkin_and_addiction()
    check_boss_and_season()
    check_crystal_and_pet()
    check_guide()
    check_release_contract()
    run_node_tests()


def main() -> int:
    run_checks()
    print("══ v960 经济 / 进度 / 发布全面守卫 ══")
    by_category: dict[str, Counter[str]] = defaultdict(Counter)
    for category, _ in PASS:
        by_category[category]["pass"] += 1
    for category, _, _ in FAIL:
        by_category[category]["fail"] += 1

    order: list[str] = []
    for category, _ in PASS:
        if category not in order:
            order.append(category)
    for category, _, _ in FAIL:
        if category not in order:
            order.append(category)
    for category in order:
        counts = by_category[category]
        icon = "✅" if counts["fail"] == 0 else "❌"
        print(f"  {icon} {category}: {counts['pass']} 通过 / {counts['fail']} 失败")

    if TEST_OUTPUT:
        print("\n全部版本化 Node 回归（含 v960）：")
        failed_names = {name for cat, name, _ in FAIL if cat == "Node运行时"}
        for name, output in TEST_OUTPUT.items():
            icon = "❌" if name in failed_names else "✅"
            print(f"  {icon} {name}: {output}")

    if FAIL:
        print("\n阻断项：")
        for category, name, detail in FAIL:
            suffix = f" — {detail}" if detail else ""
            print(f"  ❌ [{category}] {name}{suffix}")

    print(f"\n总计: {len(PASS)} 通过 / {len(FAIL)} 失败 / {len(PASS) + len(FAIL)} 项")
    if FAIL:
        print("❌ v960 经济一致性未通过：禁止打包与发布")
        return 1
    print("✅ v960 经济、跨岛进度、Boss命名、图标压缩、说明与不可变三资产发布契约全部通过")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
