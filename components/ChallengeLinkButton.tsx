"use client";

import { useState } from "react";
import { copyChallengeLink } from "@/lib/challenge-link";

interface ChallengeLinkButtonProps {
  roomId: string;
  challengerUsername: string;
  className?: string;
  disabled?: boolean;
}

export function ChallengeLinkButton({
  roomId,
  challengerUsername,
  className = "btn-broadcast text-xs",
  disabled = false,
}: ChallengeLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={className}
      disabled={disabled || copied}
      onClick={async () => {
        try {
          await copyChallengeLink(roomId, challengerUsername);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2500);
        } catch {
          // Clipboard can fail on insecure contexts — ignore.
        }
      }}
    >
      {copied ? "Link Copied" : "Send Challenge Link"}
    </button>
  );
}
