"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getGoogleLoginConfig, signInWithGoogle, type GoogleLoginConfig } from "@/services/auth";

type GoogleSdk = {
  initialize: (options: { client_id: string; nonce: string; callback: (response: { credential: string }) => void; auto_select: boolean }) => void;
  renderButton: (element: HTMLElement, options: { theme: string; size: string; text: string }) => void;
};

export function GoogleLoginButton() {
  const router = useRouter();
  const container = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const [config, setConfig] = useState<GoogleLoginConfig | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    getGoogleLoginConfig(controller.signal).then(value => { if (active) setConfig(value); })
      .catch(() => { if (active) setError("Google 로그인 설정을 불러오지 못했어요. 새로고침해주세요."); });
    return () => { active = false; controller.abort(); };
  }, []);

  const render = useCallback(() => {
    const sdk = (window as Window & { google?: { accounts: { id: GoogleSdk } } }).google?.accounts.id;
    if (!sdk || !container.current || !config?.client_id || !config.nonce) return;
    const nonce = config.nonce;
    sdk.initialize({
      client_id: config.client_id, nonce, auto_select: false,
      callback: async ({ credential }) => {
        if (busy.current) return;
        busy.current = true;
        setLoading(true);
        setError("");
        try {
          await signInWithGoogle(credential, nonce);
          const requestedPath = new URLSearchParams(window.location.search).get("next");
          const nextPath = requestedPath?.startsWith("/") && !requestedPath.startsWith("//") && !requestedPath.includes("\\") ? requestedPath : "/";
          router.replace(nextPath);
          router.refresh();
        } catch (cause) {
          setError(cause instanceof Error && !('code' in cause) ? cause.message : "Google 로그인에 실패했어요. 새로고침하고 다시 시도해주세요.");
          // 성공 응답 후 장바구니 병합만 실패한 경우에도 새 시도용 nonce를 받습니다.
          try { setConfig(await getGoogleLoginConfig()); } catch { /* 안내 문구를 유지합니다. */ }
        } finally {
          busy.current = false;
          setLoading(false);
        }
      },
    });
    container.current.replaceChildren();
    sdk.renderButton(container.current, { theme: "outline", size: "large", text: "signin_with" });
  }, [config, router]);

  useEffect(() => { if (ready) render(); }, [render, ready]);

  if (!config?.client_id) return error ? <p role="alert" className="text-sm text-danger">{error}</p> : null;
  return (
    <div className="mt-6 space-y-3 border-t pt-5" aria-busy={loading}>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive"
        onReady={() => setReady(true)} onError={() => setError("Google 로그인 버튼을 불러오지 못했어요.")} />
      <div ref={container} className={loading ? "pointer-events-none flex justify-center opacity-50" : "flex justify-center"} />
      {loading && <p role="status" className="text-center text-sm text-muted">Google 로그인 중이에요.</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
