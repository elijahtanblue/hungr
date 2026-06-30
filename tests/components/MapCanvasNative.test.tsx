import { render, waitFor } from "@testing-library/react-native";
import React from "react";
import { View } from "react-native";
import { MapCanvas } from "../../src/components/MapCanvas.native";

const mockAnimateToRegion = jest.fn();

jest.mock("react-native-maps", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MapView = React.forwardRef(({ children, ...props }: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({ animateToRegion: mockAnimateToRegion }));
    return <View testID="native-map" {...props}>{children}</View>;
  });
  const Marker = ({ children }: any) => <View>{children}</View>;
  return { __esModule: true, default: MapView, PROVIDER_GOOGLE: "google", Marker };
});

test("MapCanvas animates the native camera when the region prop changes", async () => {
  const initial = { latitude: -33.87, longitude: 151.21, latitudeDelta: 0.05, longitudeDelta: 0.05 };
  const next = { latitude: -33.861, longitude: 151.209, latitudeDelta: 0.015, longitudeDelta: 0.015 };
  const view = await render(<MapCanvas region={initial} places={[]} onSelect={() => {}} />);

  mockAnimateToRegion.mockClear();
  view.rerender(<MapCanvas region={next} places={[]} onSelect={() => {}} />);

  await waitFor(() => expect(mockAnimateToRegion).toHaveBeenCalledWith(next, 450));
});
