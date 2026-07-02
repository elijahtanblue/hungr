import { render, screen, fireEvent } from "@testing-library/react-native";
import { Alert } from "react-native";
import Taste from "../../app/taste";
import {
  getTasteTrackingSettings, setTasteTrackingEnabled, getMyTasteInsights, deleteMyTasteEvents,
} from "../../src/api/tasteTracking";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));
jest.mock("../../src/api/tasteTracking", () => ({
  getTasteTrackingSettings: jest.fn(),
  setTasteTrackingEnabled: jest.fn(),
  getMyTasteInsights: jest.fn(),
  deleteMyTasteEvents: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  (getTasteTrackingSettings as jest.Mock).mockResolvedValue({ tasteTrackingEnabled: true });
  (getMyTasteInsights as jest.Mock).mockResolvedValue([
    "You gravitate toward Italian more than anything else.",
  ]);
  (setTasteTrackingEnabled as jest.Mock).mockResolvedValue(true);
  (deleteMyTasteEvents as jest.Mock).mockResolvedValue(true);
});

test("shows learned taste as human insight sentences", async () => {
  await render(<Taste />);
  expect(await screen.findByText("You gravitate toward Italian more than anything else.")).toBeTruthy();
});

test("toggling personalization persists the choice", async () => {
  await render(<Taste />);
  await screen.findByText("You gravitate toward Italian more than anything else.");
  await fireEvent(screen.getByRole("switch"), "valueChange", false);
  expect(setTasteTrackingEnabled).toHaveBeenCalledWith(false);
});

test("deleting taste data asks for confirmation then clears it", async () => {
  const alertSpy = jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons: any) => {
    buttons.find((b: any) => b.style === "destructive").onPress();
  });

  await render(<Taste />);
  await screen.findByText("You gravitate toward Italian more than anything else.");
  await fireEvent.press(screen.getByText("Delete my taste data"));

  expect(deleteMyTasteEvents).toHaveBeenCalled();
  alertSpy.mockRestore();
});
