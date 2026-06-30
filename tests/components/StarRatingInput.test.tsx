import { fireEvent, render, screen } from "@testing-library/react-native";
import { StarRatingInput } from "../../src/components/StarRatingInput";

test("StarRatingInput lets users choose a half-star rating", async () => {
  const onChange = jest.fn();

  await render(<StarRatingInput value={null} onChange={onChange} />);

  await fireEvent.press(screen.getByLabelText("4.5 stars"));

  expect(onChange).toHaveBeenCalledWith(4.5);
});
