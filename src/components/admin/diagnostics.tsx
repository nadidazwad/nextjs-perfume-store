"use client";
import { useState, useTransition } from "react";
import { LoaderCircle, Send } from "lucide-react";
import { testNotification } from "@/lib/admin/actions";
import type { ActionResult } from "@/lib/admin/schema";
import { Result } from "./fields";
export function TestNotification() {
  const [result, setResult] = useState<ActionResult>();
  const [pending, start] = useTransition();
  return (
    <div className="admin-stack tight">
      <button
        type="button"
        className="admin-btn dark"
        disabled={pending}
        onClick={() =>
          start(async () => {
            try {
              setResult(await testNotification());
            } catch {
              setResult({
                ok: false,
                message: "Test failed. Check provider settings.",
              });
            }
          })
        }
      >
        {pending ? <LoaderCircle size={15} className="admin-spin" /> : <Send size={15} />}
        {pending ? "Sending…" : "Send test notification"}
      </button>
      <Result result={result} />
    </div>
  );
}
