from pathlib import Path

path = Path('.github/restore_original_t.py')
text = path.read_text(encoding='utf-8')

scanner = """    removed = set(EXPLICIT_REMOVE)\n    for path in COMMANDS.glob('*.js'):\n        stem = path.stem\n        if stem in SUPPORTED:\n            continue\n        text = path.read_text(encoding='utf-8', errors='ignore')\n        if NETWORK_MARKERS.search(text):\n            removed.add(stem)\n"""
if scanner in text:
    text = text.replace(scanner, "    removed = set(EXPLICIT_REMOVE)\n")

network_marker = "NETWORK_MARKERS = re.compile("
network_prelude = "EXPLICIT_REMOVE.update({'flirt', 'gif', 'trivia', 'dare', 'truth'})\nSTATIC_MEDIA_COMMANDS = {'misc', 'simp', 'stupid', 'welcome', 'goodbye'}\n"
if network_prelude not in text:
    text = text.replace(network_marker, network_prelude + network_marker, 1)

start = text.index('def remove_case_blocks(')
end = text.index('\ndef remove_external_commands()', start)
parser = '''def remove_case_blocks(main_text: str, removed_vars: set[str], removed_stems: set[str]) -> str:
    lines = main_text.splitlines(keepends=True)
    first_case = next((i for i, line in enumerate(lines) if re.match(r'^(\\s*)case\\s+', line)), None)
    if first_case is None:
        return main_text

    indent = re.match(r'^(\\s*)case\\s+', lines[first_case]).group(1)
    switch_indent = indent[:-4] if len(indent) >= 4 else ''
    switch_end = next(
        (i for i in range(first_case + 1, len(lines)) if re.match(rf'^{re.escape(switch_indent)}\\}}\\s*$', lines[i])),
        len(lines),
    )
    boundaries = [
        i for i in range(first_case, switch_end)
        if re.match(rf'^{re.escape(indent)}(?:case\\s+|default\\s*:)', lines[i])
    ]
    boundaries.append(switch_end)
    case_starts = [
        i for i in boundaries[:-1]
        if re.match(rf'^{re.escape(indent)}case\\s+', lines[i])
    ]

    remove_ranges: list[tuple[int, int]] = []
    command_tokens = {f'.{stem}' for stem in removed_stems}
    for left in case_starts:
        right = next(value for value in boundaries if value > left)
        block = ''.join(lines[left:right])
        uses_removed_identifier = any(
            re.search(rf'\\b{re.escape(name)}\\b', block)
            for name in removed_vars
        )
        uses_removed_command = any(token in block for token in command_tokens)
        if uses_removed_identifier or uses_removed_command:
            remove_ranges.append((left, right))

    for left, right in reversed(remove_ranges):
        del lines[left:right]
    return ''.join(lines)

'''
text = text[:start] + parser + text[end + 1:]

needle = "    main_text = remove_case_blocks(main_text, removed_vars, removed)\n"
replacement = needle + "    main_text = re.sub(r'^\\s*await handleChatbotResponse\\([^;]+;\\s*\\n', '', main_text, flags=re.M)\n"
if needle not in text:
    raise SystemExit('Case-removal call was not found')
text = text.replace(needle, replacement, 1)

audit_needle = "    for path in COMMANDS.glob('*.js'):\n        text = path.read_text(encoding='utf-8', errors='ignore')\n        if NETWORK_MARKERS.search(text):\n"
audit_replacement = "    for path in COMMANDS.glob('*.js'):\n        if path.stem in STATIC_MEDIA_COMMANDS:\n            continue\n        text = path.read_text(encoding='utf-8', errors='ignore')\n        if NETWORK_MARKERS.search(text):\n"
if audit_needle not in text:
    raise SystemExit('Audit scanner was not found')
text = text.replace(audit_needle, audit_replacement, 1)
path.write_text(text, encoding='utf-8')
