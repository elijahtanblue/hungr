import { renderHook, act } from "@testing-library/react-native";
import { useDebouncedValue } from "../../src/hooks/useDebouncedValue";

jest.useFakeTimers();

test("debounced value updates only after the delay", async () => {
  const r = await renderHook(({ v }: { v: string }) => useDebouncedValue(v, 300), {
    initialProps: { v: "a" },
  });
  expect(r.result.current).toBe("a");
  await r.rerender({ v: "ab" });
  expect(r.result.current).toBe("a"); // not yet
  await act(async () => { jest.advanceTimersByTime(300); });
  expect(r.result.current).toBe("ab"); // now
});
