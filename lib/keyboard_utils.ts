import {
  fgCache, clearTimeout_, timeout_, isAlive_, Stop_ as stopEvent, Lower, OnChrome, OnEdge, getTime, OnFirefox, abs_, os_
} from "./utils"

const DEL = kChar.delete, BSP = kChar.backspace, SP = kChar.space
const ENT = kChar.enter
export { ENT as ENTER }
const keyNames_: readonly kChar[] = [SP, kChar.pageup, kChar.pagedown, kChar.end, kChar.home,
    kChar.left, kChar.up, kChar.right, kChar.down]
let keyIdCorrectionOffset_old_cr_ = OnChrome && Build.MinCVer < BrowserVer.MinEnsured$KeyboardEvent$$Key
    ? Build.OS & ~(1 << kOS.mac) ? 185 as const : 300 as const : 0 as never as null
const _codeCorrectionMap = ["Semicolon", "Equal", "Comma", "Minus", "Period", "Slash", "Backquote",
    "BracketLeft", "Backslash", "BracketRight", "Quote", "IntlBackslash"]
const kCrct = OnChrome && Build.MinCVer < BrowserVer.MinEnsured$KeyboardEvent$$Key
    ? kChar.CharCorrectionList : 0 as never as null
const _modifierKeys: SafeEnum = {
    __proto__: null as never,
    Alt: 1, AltGraph: 1, Control: 1, Meta: 1, OS: 1, Shift: 1
}
const handlers_: Array<HandlerNS.Handler | kHandler> = []
let getMappedKey: (this: void, event: HandlerNS.Event, mode: kModeId) => string

export { keyNames_, getMappedKey, handlers_ as handler_stack, DEL, BSP, SP as SPC }
export function set_getMappedKey (_newGetMappedKey: typeof getMappedKey): void { getMappedKey = _newGetMappedKey }
export function set_keyIdCorrectionOffset_old_cr_ (_newKeyIdCorrectionOffset: 185 | 300 | null): void {
  keyIdCorrectionOffset_old_cr_ = _newKeyIdCorrectionOffset
}

/** only return lower-case long string */
const _getKeyName = (event: Pick<KeyboardEvent, "key" | "keyCode" | "location">): kChar => {
  let i = event.keyCode, s: string | undefined
  return i > kKeyCode.space - 1 && i < kKeyCode.minNotDelete
      ? i < kKeyCode.insert ? keyNames_[i - kKeyCode.space] : i > kKeyCode.insert ? DEL : kChar.insert
      : i < kKeyCode.minNotDelete || i === kKeyCode.metaKey
        || Build.OS & (1 << kOS.mac) && i === (OnFirefox ? kKeyCode.os_ff_mac : kKeyCode.osRight_mac)
            && (!(Build.OS & ~(1 << kOS.mac)) || os_ === kOS.mac)
      ? (i === kKeyCode.backspace ? BSP : i === kKeyCode.esc ? kChar.esc
          : i === kKeyCode.tab ? kChar.tab : i === kKeyCode.enter ? ENT
          : (i < kKeyCode.maxAcsKeys + 1 ? i > kKeyCode.minAcsKeys - 1 : i > kKeyCode.maxNotMetaKey)
            && fgCache.a && fgCache.a === event.location ? kChar.Modifier
          : kChar.None
        )
      : i === kKeyCode.menuKey && Build.BTypes & ~BrowserType.Safari
        && (Build.BTypes & ~BrowserType.Chrome || Build.OS & ~kOS.mac) ? kChar.Menu
      : ((s = event.key) ? (<RegExpOne> /^F\d/).test(s) : i > kKeyCode.maxNotFn && i < kKeyCode.minNotFn)
      ? ("f" + (s ? s.slice(1) : i - kKeyCode.maxNotFn)) as kChar.F_num
      : kChar.None
}

  /** return single characters which only depend on `shiftKey` (CapsLock is ignored) */
const _getKeyCharUsingKeyIdentifier_old_cr = !OnChrome
        || Build.MinCVer >= BrowserVer.MinEnsured$KeyboardEvent$$Key ? 0 as never
      : function (event: Pick<OldKeyboardEvent, "keyIdentifier">, shiftKey: BOOL): string {
    let s: string | undefined = event.keyIdentifier,
    keyId: kCharCode = s.startsWith("U+") ? parseInt(s.slice(2), 16) : 0;
    if (keyId < kCharCode.minNotAlphabet) {
      return keyId < kCharCode.minNotSpace ? ""
          : shiftKey && keyId > kCharCode.maxNotNum && keyId < kCharCode.minNotNum
          ? kChar.EnNumTrans[keyId - kCharCode.N0]
          : String.fromCharCode(keyId < kCharCode.minAlphabet || shiftKey ? keyId : keyId + kCharCode.CASE_DELTA);
    } else {
      // here omits a `(...)` after the first `&&`, since there has been `keyId >= kCharCode.minNotAlphabet`
      return Build.OS & ~(1 << kOS.mac) && keyId > keyIdCorrectionOffset_old_cr_!
          && (keyId -= 186) < 7 || (keyId -= 26) > 6 && keyId < 11
          ? kCrct![keyId + shiftKey * 12]
          : "";
    }
} as (event: Pick<OldKeyboardEvent, "keyIdentifier">, shiftKey: BOOL) => string

/**
 * * return `"space"` for the <Space> key - in most code it needs to be treated as a long key
 * * does not skip "Unidentified", because it can not solve any issue if skipping it
 */
export const char_ = (eventWrapper: HandlerNS.Event): kChar => {
  let event: Pick<KeyboardEvent, "code" | "key" | "keyCode" | "keyIdentifier" | "location" | "shiftKey" | "altKey">
        = eventWrapper.e
  const shiftKey = OnFirefox ? hasShift_ff!(event as KeyboardEvent) : event.shiftKey
  let mapped: number | undefined, key = event.key!, isDeadKey = !OnEdge && key === "Dead"
  if (OnChrome && Build.MinCVer < BrowserVer.MinEnsured$KeyboardEvent$$Key && !key) {
    // since Browser.Min$KeyboardEvent$MayHave$$Key and before .MinEnsured$KeyboardEvent$$Key
    // event.key may be an empty string if some modifier keys are held on
    // it seems that KeyIdentifier doesn't follow keyboard layouts
    key = _getKeyName(event) // it's safe to skip the check of `event.keyCode`
        || /*#__NOINLINE__*/ _getKeyCharUsingKeyIdentifier_old_cr(event as Pick<OldKeyboardEvent, "keyIdentifier">
            , +shiftKey as BOOL)
  } else if (!OnEdge && (fgCache.l > 0 && (fgCache.l > 1 || event.altKey) || isDeadKey)) {
      /** return strings of 1-N characters and CapsLock is ignored */
    let code = event.code!, prefix = code.slice(0, 3), isKeyShort = key.length < 2 || isDeadKey
    if (prefix !== "Num") { // not (Numpad* or NumLock)
      // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code/code_values
      if (prefix === "Key" || prefix === "Dig" || prefix === "Arr") {
        code = code.slice(code < "K" ? 5 : 3);
      }
      // Note: <Alt+P> may generate an upper-case '\u013b' on Mac,
      // so for /^Key[A-Z]/, can assume the status of CapsLock.
      // https://github.com/philc/vimium/issues/2161#issuecomment-225813082
      key = code.length === 1 && isKeyShort
            ? !shiftKey || code < "0" || code > "9" ? code : kChar.EnNumTrans[+code]
            : _modifierKeys[key] ? fgCache.a && event.location === fgCache.a ? kChar.Modifier : ""
            : key === "Escape" ? kChar.esc // e.g. https://github.com/gdh1995/vimium-c/issues/129
            // 1. an example of code is empty is https://github.com/philc/vimium/issues/3451#issuecomment-569124026
            // 2. if both `key` is long, then prefer `key` to support outside mappings (like composed-key-as-an-action).
            //    see https://github.com/gdh1995/vimium-c/issues/435
            : code.length < 2 || !isKeyShort ? key.startsWith("Arrow") ? key.slice(5) : key
            : (mapped = _codeCorrectionMap.indexOf(code)) < 0 ? code
            : (OnChrome && Build.MinCVer < BrowserVer.MinEnsured$KeyboardEvent$$Key
                ? kCrct! : kChar.CharCorrectionList)[mapped + 12 * +shiftKey]
    }
    key = shiftKey && key.length < 2 ? key : Lower(key)
  } else {
    key = key.length > 1 || key === " " ? /*#__NOINLINE__*/ _getKeyName(event)
        : fgCache.i ? shiftKey ? key.toUpperCase() : Lower(key) : key
  }
  return eventWrapper.c = key as kChar
}

export const keybody_ = (key: string): kChar => (key.slice(key.lastIndexOf("-") + 1) || key && kChar.minus) as kChar

export const hasShift_ff = OnFirefox ? (event: Pick<KeyboardEvent, "shiftKey" | "key" | "getModifierState">): boolean => {
  if (!OnFirefox) { return event.shiftKey }
  const key = event.key!
  // if `privacy.resistFingerprinting` && CapsLock && A-Z, then Shift is reversed
  return key.length === 1 && event.getModifierState("CapsLock") ? key !== key.toUpperCase() : event.shiftKey
} : 0 as never as null

export const getKeyStat_ = (event: Pick<KeyboardEvent, "altKey" | "ctrlKey" | "metaKey" | "shiftKey">
      , ignoreShift?: 1): KeyStat =>
    <number> <boolean|number> event.altKey |
            (<number> <boolean|number> event.ctrlKey * 2) |
            (<number> <boolean|number> event.metaKey * 4) |
            (ignoreShift ? 0
              : <number> <boolean|number> (OnFirefox ? hasShift_ff!(event as KeyboardEvent) : event.shiftKey) * 8)

export const isEscape_ = (key: string): HandlerResult.AdvancedEsc | HandlerResult.PlainEsc | HandlerResult.Nothing => {
    return key === kChar.esc ? HandlerResult.AdvancedEsc
        : key === "c-" + kChar.bracketLeft ? HandlerResult.PlainEsc : HandlerResult.Nothing;
}

/** handler section */

export const prevent_ = (event: ToPrevent): void => {
    event.preventDefault(); stopEvent(event);
}

export const replaceOrSuppressMost_ = ((id: kHandler, newHandler?: HandlerNS.Handler): void => {
  removeHandler_(id)
  pushHandler_(newHandler || ((event: HandlerNS.Event): HandlerResult => {
    isEscape_(getMappedKey(event, <kModeId> <number> id)) && removeHandler_(id)
    return event.i === kKeyCode.f12 || event.i === kKeyCode.f5 ? HandlerResult.Suppress : HandlerResult.Prevent;
  }), id)
}) as {
  (id: kHandler, newHandler: HandlerNS.Handler): void
  (id: kHandler.linkHints | kHandler.omni | kHandler.find | kHandler.visual | kHandler.marks): void
}

export const whenNextIsEsc_ = (id: kHandler, modeId: kModeId, onEsc: HandlerNS.VoidHandler<void>): void => {
  replaceOrSuppressMost_(id, (event): HandlerResult => {
    const key = getMappedKey(event, modeId)
    key && removeHandler_(id)
    return isEscape_(key) ? (onEsc(), HandlerResult.Prevent) : HandlerResult.Nothing
  })
}

  /**
   * if not timeout, then only suppress repeated keys; otherwise wait until no new keys for a while
   *
   * @argument callback can only be true if `timeout`; 0 means not to reset timer on a new key
   */
export const suppressTail_ = ((timeout?: number
    , callback?: HandlerNS.VoidHandler<unknown> | 0): HandlerNS.Handler | HandlerNS.VoidHandler<HandlerResult> => {
  let timer: ValidTimeoutID = TimerID.None, now: number, func = (event?: HandlerNS.Event): HandlerResult => {
      if (!timeout) {
        if (event!.e.repeat) { return HandlerResult.Prevent }
        exit()
        return HandlerResult.Nothing;
      }
      if (event && (abs_(getTime() - now) > timeout || isEscape_(getMappedKey(event, kModeId.Plain)))) {
        exit()
        return HandlerResult.Nothing
      }
      if (!timer || callback !== 0) {
        clearTimeout_(timer)
        now = getTime()
        timer = timeout_(exit, timeout) // safe-time
      }
      return HandlerResult.Prevent;
  }, exit = (): void => {
    removeHandler_(func as never as kHandler.suppressTail)
    callback && isAlive_ && callback()
  }
  timeout && func()
  if (!callback) {
    pushHandler_(func, func as never as kHandler.suppressTail)
  }
  return func
}) as {
  (timeout?: number, callback?: undefined): unknown
  (timeout: number, callback: HandlerNS.VoidHandler<any> | 0): HandlerNS.VoidHandler<HandlerResult>
}

export const pushHandler_ = handlers_.push.bind(handlers_) as (func: HandlerNS.Handler, id: kHandler) => number

export const removeHandler_ = (id: kHandler): void => {
  const i = handlers_.lastIndexOf(id)
  if (i > 0) { handlers_.splice(i - 1, 2) }
}

  /** misc section */

if (!(Build.NDEBUG || BrowserVer.MinEnsured$KeyboardEvent$$Code < BrowserVer.MinNo$KeyboardEvent$$keyIdentifier)
    || !(Build.NDEBUG || BrowserVer.MinEnsured$KeyboardEvent$$Key < BrowserVer.MinNo$KeyboardEvent$$keyIdentifier)) {
  console.log("Assert error: KeyboardEvent.key/code should exist before Chrome version"
      , BrowserVer.MinNo$KeyboardEvent$$keyIdentifier);
}
if (!(Build.NDEBUG || BrowserVer.MinEnsured$KeyboardEvent$$Code < BrowserVer.MinEnsured$KeyboardEvent$$Key)) {
  console.log("Assert error: need KeyboardEvent.code to exist if only .key exists");
}
