"""Build the bloom-compat Spicetify extension from the compat section of src/user.css.

Spotify 1.3.3 stopped rendering many of the readable class names Bloom's rules use (cards, the
track list, the player bar...). compat/spotify-1.3.3.json maps each one to the element that took
its place. This script copies every Bloom rule that uses a mapped class, in its original order,
with each such class widened to `:is(.old, new)`, and writes those copies to the end of
src/user.css between the GENERATED markers. The compat section (everything from COMPAT_START to
the end of the file) is then wrapped into bloom-compat.js.

Usage: python compat/build.py [--install]
  --install  also copy the result to %APPDATA%/spicetify/Extensions/bloom-compat.js
"""
import json
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
USER_CSS = os.path.join(ROOT, "src", "user.css")
MAP_FILE = os.path.join(ROOT, "compat", "spotify-1.3.3.json")
TEMPLATE = os.path.join(ROOT, "compat", "bloom-compat.template.js")
OUT = os.path.join(ROOT, "compat", "bloom-compat.js")

COMPAT_START = "/* ===== Bloom -> Spotify 1.3 compatibility layer (generated) ====="
GEN_START = "/* ===== GENERATED: Spotify 1.3.3 re-pointed rules (compat/build.py) ====="
GEN_END = "/* ===== END GENERATED: Spotify 1.3.3 ===== */"
TILT_BASE = ".main-entityHeader-imageContainer, .main-entityHeader-imageContainerNew"


def strip_comments(css):
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)


def blocks(css):
    """Yield (prelude, body) for each top-level block; body is the text between the braces."""
    i, n = 0, len(css)
    while i < n:
        j = css.find("{", i)
        if j < 0:
            return
        prelude = css[i:j]
        # A statement at-rule such as @import ends with ';' before the brace.
        if ";" in prelude:
            prelude = prelude[prelude.rfind(";") + 1:]
        depth, k = 1, j + 1
        while k < n and depth:
            if css[k] == "{":
                depth += 1
            elif css[k] == "}":
                depth -= 1
            k += 1
        yield prelude.strip(), css[j + 1:k - 1]
        i = k


def declarations(body):
    """Split a rule body on the semicolons between declarations (not those inside strings or url())."""
    parts, start, depth, quote = [], 0, 0, None
    for i, ch in enumerate(body):
        if quote:
            if ch == quote and body[i - 1] != "\\":
                quote = None
        elif ch in "\"'":
            quote = ch
        elif ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        elif ch == ";" and depth == 0:
            parts.append(body[start:i])
            start = i + 1
    parts.append(body[start:])
    return parts


def repoint(selector, pattern, mapping):
    return pattern.sub(lambda m: ":is(.%s, %s)" % (m.group(1), mapping[m.group(1)]), selector)


def generate(css, mapping):
    names = sorted(mapping, key=len, reverse=True)
    pattern = re.compile(r"\.(%s)(?![\w-])" % "|".join(re.escape(n) for n in names))
    out = []

    def walk(text, indent):
        for prelude, body in blocks(text):
            if prelude.startswith("@"):
                if re.match(r"@(media|supports|container|layer)\b", prelude):
                    inner = []
                    walk_into(body, inner)
                    if inner:
                        out.append(indent + prelude + " {")
                        out.extend("  " + line for line in inner)
                        out.append(indent + "}")
                continue
            if pattern.search(prelude):
                out.append(indent + re.sub(r"\s+", " ", repoint(prelude, pattern, mapping)) + " {")
                if "{" in body:
                    # Nested rules: copied whole, so the nesting stays intact.
                    out.append(indent + "  " + re.sub(r"\s+", " ", body.strip()))
                else:
                    for decl in declarations(body):
                        if decl.strip():
                            out.append(indent + "  " + re.sub(r"\s+", " ", decl.strip()) + ";")
                out.append(indent + "}")

    def walk_into(body, inner):
        saved = len(out)
        walk(body, "")
        inner.extend(out[saved:])
        del out[saved:]

    walk(css, "")
    return "\n".join(out)


def main():
    mapping = {k: v for k, v in json.load(open(MAP_FILE, encoding="utf-8")).items() if not k.startswith("_")}
    text = open(USER_CSS, encoding="utf-8").read()
    if GEN_START in text:
        text = text[:text.index(GEN_START)].rstrip() + "\n"
    if COMPAT_START not in text:
        sys.exit("compat section not found in src/user.css")

    generated = generate(strip_comments(text), mapping)
    header = (
        GEN_START + "\n"
        "   Spotify 1.3.3 no longer renders the readable classes listed in compat/spotify-1.3.3.json.\n"
        "   Each rule above that uses one is repeated here, in the same order, with that class widened\n"
        "   to also match the element that replaced it. Do not edit by hand: change the map or the\n"
        "   rules above and run compat/build.py. */\n"
    )
    text = text + "\n" + header + generated + "\n" + GEN_END + "\n"
    open(USER_CSS, "w", encoding="utf-8", newline="\n").write(text)

    compat = text[text.index(COMPAT_START):]
    names = sorted(mapping, key=len, reverse=True)
    pattern = re.compile(r"\.(%s)(?![\w-])" % "|".join(re.escape(n) for n in names))
    tilt = repoint(TILT_BASE, pattern, mapping)
    js = open(TEMPLATE, encoding="utf-8").read()
    js = js.replace("__CSS__", json.dumps(compat)).replace("__TILT_TARGET__", json.dumps(tilt))
    open(OUT, "w", encoding="utf-8", newline="\n").write(js)
    print("generated %d lines of re-pointed rules; wrote %s (%d bytes)" % (generated.count("\n") + 1, OUT, len(js)))

    if "--install" in sys.argv:
        dest = os.path.join(os.environ["APPDATA"], "spicetify", "Extensions", "bloom-compat.js")
        shutil.copyfile(OUT, dest)
        print("installed to", dest)


if __name__ == "__main__":
    main()
