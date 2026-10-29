/**
 * dsh-netqos 客户端：设置 → 网速守卫
 * 白名单软件在跑的时候，让 Coopanion / SnowLuma 限速或让路。
 */
window.__ModuleLoader__.load({
  id: "dsh-netqos",
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" })

    const React = require("react")
    const { createElement: h, useCallback, useEffect, useState } = React

    const API = "/dsh-netqos/api"
    const CSS_TAG = "dsh-netqos/section.css"
    const CSS = [
      ".nq{max-width:760px;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;gap:6px}",
      ".nq-title{margin:0;font-size:16px;font-weight:500;line-height:24px}",
      ".nq-intro{color:var(--dsw-alias-label-tertiary);margin:0 0 4px;font-size:13px;line-height:20px}",
      ".nq-row{display:flex;justify-content:space-between;align-items:flex-start;gap:12px 20px;padding:10px 0;border-bottom:.5px solid var(--dsw-alias-border-l2);flex-wrap:wrap}",
      ".nq-row:last-child{border-bottom:none}",
      ".nq-label{font-size:13px;line-height:19px}",
      ".nq-hint{color:var(--dsw-alias-label-tertiary);margin-top:3px;font-size:11.5px;line-height:17px}",
      ".nq-input,.nq-select{background:transparent;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;color:var(--dsw-alias-label-primary);font-size:12.5px;height:28px;padding:0 8px;outline:none}",
      ".nq-input{min-width:120px}.nq-input.wide{min-width:170px}",
      ".nq-input:focus-visible,.nq-select:focus-visible{border-color:var(--dsw-alias-brand-primary)}",
      ".nq-btn{border:.5px solid var(--dsw-alias-border-l3,var(--dsw-alias-border-l2,#8884));border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font-size:12.5px;height:28px;padding:0 10px;cursor:pointer;font-family:inherit}",
      ".nq-btn:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);outline-offset:2px}",
      ".nq-btn:hover{border-color:var(--dsw-alias-brand-primary)}",
      ".nq-btn.primary{background:var(--dsw-alias-button-primary-fill,#4d6bfe);border-color:var(--dsw-alias-button-primary-fill,#4d6bfe);color:var(--dsw-alias-label-primary-foreground,#fff);font-weight:600}",
      ".nq-btn.primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-button-primary-fill,#4262e0));border-color:var(--dsw-alias-button-primary-hover,var(--dsw-alias-button-primary-fill,#4262e0))}",
      ".nq-btn:disabled{opacity:.5;cursor:default}",
      ".nq-status{font-size:13px;line-height:20px;padding:8px 10px;border-radius:6px;background:var(--dsw-alias-bg-l2,#0001)}",
      ".nq-log{margin:6px 0 0;padding:8px 10px;border-radius:6px;background:var(--dsw-alias-bg-l2,#0001);font-size:11.5px;line-height:17px;white-space:pre-wrap;color:var(--dsw-alias-label-tertiary);max-height:160px;overflow:auto}",
      ".nq-actions{display:flex;gap:8px;align-items:center;margin-top:12px}",
      ".nq-toast{font-size:12px;color:var(--dsw-alias-label-tertiary)}",
    ].join("\n")

    function useCss() {
      useEffect(() => {
        if (typeof document === "undefined") return
        if (document.querySelector("style[data-dsh-css='" + CSS_TAG + "']")) return
        const el = document.createElement("style")
        el.dataset.dshCss = CSS_TAG
        el.textContent = CSS
        document.head.appendChild(el)
      }, [])
    }

    async function api(path, init) {
      const res = await fetch(API + path, { credentials: "same-origin", ...init })
      const body = await res.json().catch(() => ({ ok: false, error: "响应不是 JSON" }))
      if (!res.ok || body.ok === false) throw new Error(body.error || "HTTP " + res.status)
      return body
    }

    function Section() {
      useCss()
      const [cfg, setCfg] = useState({ rateKBps: 128, targets: ["Coopanion.exe", "SnowLuma.exe", "DeepSeek Harness.exe"], apps: [] })
      const [state, setState] = useState("")
      const [log, setLog] = useState([])
      const [loading, setLoading] = useState(true)
      const [saving, setSaving] = useState(false)
      const [msg, setMsg] = useState("")

      const load = useCallback(async () => {
        try {
          const b = await api("/state")
          setCfg(b.config)
          setState(b.state || "")
          setLog(b.log || [])
          setMsg("")
        } catch (e) {
          setMsg("读取失败：" + e.message)
        } finally {
          setLoading(false)
        }
      }, [])

      useEffect(() => { void load() }, [load])
      useEffect(() => {
        const t = setInterval(() => { void load() }, 5000)
        return () => clearInterval(t)
      }, [load])

      const patch = (p) => setCfg((c) => ({ ...c, ...p }))
      const setApp = (i, k, v) => setCfg((c) => ({ ...c, apps: c.apps.map((a, j) => (j === i ? { ...a, [k]: v } : a)) }))
      const addApp = () => setCfg((c) => ({ ...c, apps: [...c.apps, { exe: "", action: "throttle" }] }))
      const delApp = (i) => setCfg((c) => ({ ...c, apps: c.apps.filter((_, j) => j !== i) }))

      const save = async () => {
        setSaving(true)
        try {
          const b = await api("/config", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(cfg),
          })
          setCfg(b.config)
          setMsg("已保存")
          setTimeout(() => setMsg(""), 2500)
          void load()
        } catch (e) {
          setMsg("保存失败：" + e.message)
        } finally {
          setSaving(false)
        }
      }

      const active = state && !/^正常$/.test(state)

      return h("div", { className: "nq" },
        h("h2", { className: "nq-title" }, "网速守卫"),
        h("p", { className: "nq-intro" }, "你打开下面这些软件时，Coopanion / SnowLuma / 我也一起被限速或让路；一关掉就自动恢复。"),
        h("div", { className: "nq-status" }, loading ? "读取中…" : (state ? "助手状态：" + state : "助手还没起来（SYSTEM 任务没在跑）")),
        active && h("p", { className: "nq-hint" }, "现在正在让路，游戏结束会自动恢复。"),

        h("div", { className: "nq-row" },
          h("div", null,
            h("div", { className: "nq-label" }, "限速值"),
            h("div", { className: "nq-hint" }, "白名单选「限速」时，每个目标进程的上限（KB/s）")),
          h("input", {
            className: "nq-input",
            type: "number",
            min: 8,
            value: cfg.rateKBps,
            onChange: (e) => patch({ rateKBps: Number(e.target.value) || 0 }),
          })),

        h("div", { className: "nq-row" },
          h("div", null,
            h("div", { className: "nq-label" }, "被限的对象"),
            h("div", { className: "nq-hint" }, cfg.targets.join("、"))),
          h("span", { className: "nq-hint" }, "默认 Coopanion、SnowLuma、DeepSeek Harness")),

        h("div", { className: "nq-label", style: { marginTop: "14px", fontWeight: 600 } }, "触发软件（你在跑这些时，让 Coopanion 让路）"),
        cfg.apps.length === 0 && h("p", { className: "nq-hint" }, "还没有。加一条，比如 cod.exe——你开游戏，它就让路。"),
        cfg.apps.map((a, i) =>
          h("div", { className: "nq-row", key: i },
            h("div", { style: { flex: 1, minWidth: "190px" } },
              h("input", {
                className: "nq-input wide",
                placeholder: "进程名，例如 cod.exe",
                value: a.exe,
                onChange: (e) => setApp(i, "exe", e.target.value),
              })),
            h("div", { style: { display: "flex", gap: "8px", alignItems: "center" } },
              h("select", {
                className: "nq-select",
                value: a.action,
                onChange: (e) => setApp(i, "action", e.target.value),
              },
                h("option", { value: "throttle" }, "限速"),
                h("option", { value: "pause" }, "几乎断开")),
              h("button", { className: "nq-btn", onClick: () => delApp(i) }, "删除")))),
        h("div", { className: "nq-actions" },
          h("button", { className: "nq-btn", onClick: addApp }, "+ 添加一个"),
          h("button", { className: "nq-btn primary", onClick: save, disabled: saving }, saving ? "保存中…" : "保存"),
          msg && h("span", { className: "nq-toast" }, msg)),
        log.length > 0 && h("pre", { className: "nq-log" }, log.join("\n")))
    }

    const inject = ["slots"]
    const NS = "netqos"
    const NAMES = { nav: "网速守卫" }

    function apply(ctx) {
      ctx.effect(
        () =>
          ctx.slots.inject("settings.section", () =>
            ctx.slots.register(
              { name: "settings.section", id: NS, order: 8, label: () => NAMES.nav },
              Section,
            ),
            "netqos: settings section",
          ),
        "netqos: settings section",
      )
    }

    exports.apply = apply
    exports.inject = inject
    exports.NetqosSection = Section
    return module.exports
  },
})
