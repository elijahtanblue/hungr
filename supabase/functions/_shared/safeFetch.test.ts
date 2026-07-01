import { isBlockedAddress, isAllowedScheme, safeFetch, type SafeFetchDeps } from "./safeFetch.ts";

Deno.test("isBlockedAddress blocks loopback, private, link-local, multicast", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.1", "192.168.1.1", "169.254.1.1", "0.0.0.0", "100.64.0.1", "224.0.0.1", "255.255.255.255"]) {
    if (!isBlockedAddress(ip)) throw new Error(`${ip} should be blocked`);
  }
});

Deno.test("isBlockedAddress allows normal public IPv4", () => {
  for (const ip of ["8.8.8.8", "1.1.1.1", "203.0.113.5", "172.15.0.1", "172.32.0.1"]) {
    if (isBlockedAddress(ip)) throw new Error(`${ip} should be allowed`);
  }
});

Deno.test("isBlockedAddress handles IPv6 loopback, ULA, link-local, multicast, and v4-mapped", () => {
  for (const ip of ["::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "ff02::1", "::ffff:127.0.0.1"]) {
    if (!isBlockedAddress(ip)) throw new Error(`${ip} should be blocked`);
  }
  if (isBlockedAddress("2606:4700:4700::1111")) throw new Error("public IPv6 should be allowed");
});

Deno.test("isBlockedAddress fails closed on malformed input", () => {
  if (!isBlockedAddress("999.1.1.1")) throw new Error("out-of-range octet should block");
  if (!isBlockedAddress("not-an-ip")) throw new Error("garbage should block");
});

Deno.test("isAllowedScheme is https-only", () => {
  if (!isAllowedScheme(new URL("https://example.com"))) throw new Error("https allowed");
  if (isAllowedScheme(new URL("http://example.com"))) throw new Error("http blocked");
  if (isAllowedScheme(new URL("file:///etc/passwd"))) throw new Error("file blocked");
});

Deno.test("safeFetch rejects a host that resolves to a private IP", async () => {
  const deps: SafeFetchDeps = {
    resolve: async () => ["127.0.0.1"],
    fetchImpl: async () => { throw new Error("must not fetch a blocked host"); },
  };
  if (await safeFetch("https://evil.example", deps) !== null) throw new Error("should reject blocked resolution");
});

Deno.test("safeFetch re-checks a redirect that points at an internal IP", async () => {
  let call = 0;
  const deps: SafeFetchDeps = {
    resolve: async (host) => (host === "public.example" ? ["8.8.8.8"] : ["169.254.169.254"]),
    fetchImpl: async () => {
      call++;
      // First hop: public host 302s to the cloud metadata endpoint.
      return new Response(null, { status: 302, headers: { location: "https://metadata.internal/latest" } });
    },
  };
  const out = await safeFetch("https://public.example", deps);
  if (out !== null) throw new Error("redirect to internal IP must be rejected");
  if (call !== 1) throw new Error("should have stopped after the first redirect, before fetching internal host");
});

Deno.test("safeFetch returns body for a healthy public https page", async () => {
  const deps: SafeFetchDeps = {
    resolve: async () => ["8.8.8.8"],
    fetchImpl: async () => new Response("<html>ok</html>", { status: 200, headers: { "content-type": "text/html" } }),
  };
  const out = await safeFetch("https://good.example", deps);
  if (out !== "<html>ok</html>") throw new Error(`expected body, got ${out}`);
});

Deno.test("safeFetch rejects a non-html content type", async () => {
  const deps: SafeFetchDeps = {
    resolve: async () => ["8.8.8.8"],
    fetchImpl: async () => new Response("{}", { status: 200, headers: { "content-type": "application/pdf" } }),
  };
  if (await safeFetch("https://good.example", deps) !== null) throw new Error("pdf should be rejected");
});

Deno.test("safeFetch rejects non-https", async () => {
  const deps: SafeFetchDeps = {
    resolve: async () => ["8.8.8.8"],
    fetchImpl: async () => new Response("x", { status: 200, headers: { "content-type": "text/html" } }),
  };
  if (await safeFetch("http://good.example", deps) !== null) throw new Error("http should be rejected");
});
