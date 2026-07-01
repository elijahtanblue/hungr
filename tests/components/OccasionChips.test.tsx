import { render, fireEvent, screen } from "@testing-library/react-native";
import { OccasionChips } from "../../src/components/OccasionChips";
import { occasionById } from "../../src/domain/occasionPresets";

test("renders a chip per occasion and reports the picked occasion", async () => {
  const onPick = jest.fn();
  await render(<OccasionChips activeId={null} onPick={onPick} />);
  await fireEvent.press(screen.getByText("Date night"));
  expect(onPick).toHaveBeenCalledWith(occasionById("date-night"));
});

test("re-tapping the active occasion clears it", async () => {
  const onPick = jest.fn();
  await render(<OccasionChips activeId="date-night" onPick={onPick} />);
  await fireEvent.press(screen.getByText("Date night"));
  expect(onPick).toHaveBeenCalledWith(null);
});
