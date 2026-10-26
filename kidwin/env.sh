# Team KID environment — sourced from ~/.profile and ~/.bashrc.
case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) export PATH="$HOME/.local/bin:$PATH" ;; esac
# kid-gateway on: the claude shim routes PO / Dev / QA through the gateway (KID unchanged)
[ -f "$HOME/.teamkid/gateway.env" ] && case ":$PATH:" in *":$HOME/.teamkid/bin:"*) ;; *) export PATH="$HOME/.teamkid/bin:$PATH" ;; esac

# One-shot autostart: the first interactive shell herdr opens within 30s of start-kid runs KID
# for the chosen project. The flag is taken with an atomic rename, so panes opened later
# (Builders, QA) never start KID.
if [ -n "${PS1:-}" ] && [ "${HERDR_ENV:-}" = 1 ] && [ -f "$HOME/.teamkid/autostart" ]; then
  if mv "$HOME/.teamkid/autostart" "$HOME/.teamkid/autostart.$$" 2>/dev/null; then
    read -r _kid_t _kid_p < "$HOME/.teamkid/autostart.$$"; rm -f "$HOME/.teamkid/autostart.$$"
    if [ -n "${_kid_t:-}" ] && [ $(( $(date +%s) - _kid_t )) -lt 30 ]; then
      kid ${_kid_p:+"$_kid_p"}
    fi
    unset _kid_t _kid_p
  fi
fi
