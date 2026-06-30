import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import Trends from "../../app/(tabs)/trends";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));

test("Trends respects the phone safe area at the top", async () => {
  await render(<Trends />);
  const screenRoot = screen.getByTestId("trends-screen");
  expect(StyleSheet.flatten(screenRoot.props.style).paddingTop).toBeGreaterThan(47);
});
