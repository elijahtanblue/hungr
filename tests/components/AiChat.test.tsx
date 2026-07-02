import { render, screen, fireEvent } from "@testing-library/react-native";
import AiChat from "../../app/ai-chat";
import { askAiChat } from "../../src/api/aiChat";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("expo-router", () => ({ router: { back: jest.fn(), push: jest.fn() } }));
jest.mock("../../src/api/aiChat", () => ({ askAiChat: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

test("shows starter prompts before any conversation", async () => {
  await render(<AiChat />);
  expect(screen.getByText("What are you in the mood for?")).toBeTruthy();
  expect(screen.getByText("Cheap, delicious lunch near me")).toBeTruthy();
});

test("sending a message shows the reply, follow-up, and taste-memory note", async () => {
  (askAiChat as jest.Mock).mockResolvedValue({
    answer: "Try Osteria on the water, quiet and romantic.",
    followUpQuestion: "What's your budget?",
    memoriesUpdated: 1,
  });

  await render(<AiChat />);
  await fireEvent.changeText(screen.getByPlaceholderText("Ask hungrAI…"), "date night by the water");
  await fireEvent.press(screen.getByLabelText("Send"));

  expect(askAiChat).toHaveBeenCalledWith("date night by the water");
  expect(await screen.findByText("Try Osteria on the water, quiet and romantic.")).toBeTruthy();
  expect(screen.getByText("date night by the water")).toBeTruthy();
  expect(screen.getByText("What's your budget?")).toBeTruthy();
  expect(screen.getByText("Saved 1 to your taste profile")).toBeTruthy();
});

test("the assistant follow-up is not sent as a user message when tapped", async () => {
  (askAiChat as jest.Mock).mockResolvedValue({
    answer: "I need one more detail.",
    followUpQuestion: "Which area should I search?",
    memoriesUpdated: 0,
  });

  await render(<AiChat />);
  await fireEvent.changeText(screen.getByPlaceholderText("Ask hungrAI…"), "cheap lunch near me");
  await fireEvent.press(screen.getByLabelText("Send"));
  await screen.findByText("Which area should I search?");

  await fireEvent.press(screen.getByText("Which area should I search?"));
  expect(askAiChat).toHaveBeenCalledTimes(1);
});

test("a starter prompt sends immediately", async () => {
  (askAiChat as jest.Mock).mockResolvedValue({ answer: "Here are a few spots.", followUpQuestion: null, memoriesUpdated: 0 });
  await render(<AiChat />);
  await fireEvent.press(screen.getByText("Cheap, delicious lunch near me"));
  expect(askAiChat).toHaveBeenCalledWith("Cheap, delicious lunch near me");
  expect(await screen.findByText("Here are a few spots.")).toBeTruthy();
});

test("follow-up messages send recent in-session context", async () => {
  (askAiChat as jest.Mock)
    .mockResolvedValueOnce({
      answer: "Tell me the area, budget, and whether you want reliable or adventurous.",
      followUpQuestion: null,
      memoriesUpdated: 0,
    })
    .mockResolvedValueOnce({
      answer: "I have enough to shortlist Sydney CBD anniversary places.",
      followUpQuestion: null,
      memoriesUpdated: 0,
    });

  await render(<AiChat />);
  await fireEvent.changeText(screen.getByPlaceholderText("Ask hungrAI…"), "Looking for a date night anniversary dinner");
  await fireEvent.press(screen.getByLabelText("Send"));
  await screen.findByText("Tell me the area, budget, and whether you want reliable or adventurous.");

  await fireEvent.changeText(screen.getByPlaceholderText("Ask hungrAI…"), "Sydney CBD, under $200pp, adventurous");
  await fireEvent.press(screen.getByLabelText("Send"));

  expect(askAiChat).toHaveBeenLastCalledWith("Sydney CBD, under $200pp, adventurous", [
    { role: "user", text: "Looking for a date night anniversary dinner" },
    { role: "assistant", text: "Tell me the area, budget, and whether you want reliable or adventurous." },
  ]);
});

test("a failed request shows a graceful fallback", async () => {
  (askAiChat as jest.Mock).mockRejectedValue(new Error("network"));
  await render(<AiChat />);
  await fireEvent.changeText(screen.getByPlaceholderText("Ask hungrAI…"), "sushi");
  await fireEvent.press(screen.getByLabelText("Send"));
  expect(await screen.findByText("I could not reach hungrAI just now. Try again in a moment.")).toBeTruthy();
});
