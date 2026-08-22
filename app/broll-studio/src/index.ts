import React from "react";
import { Composition } from "remotion";
import { Card, CardProps } from "./Card";

const defaultProps: CardProps = {
  keyword: "key moment",
  palette: 0,
  kind: "broll",
};

const calc = ({ props }: { props: CardProps }) => ({
  durationInFrames: Math.max(
    18,
    Math.round((props.kind === "overlay" ? 2.6 : 2.8) * 30)
  ),
});

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="BrollCard"
        component={Card}
        durationInFrames={84}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ ...defaultProps, kind: "broll" }}
        calculateMetadata={calc as never}
      />
      <Composition
        id="OverlayCard"
        component={Card}
        durationInFrames={78}
        fps={30}
        width={1080}
        height={460}
        defaultProps={{ ...defaultProps, kind: "overlay" }}
        calculateMetadata={calc as never}
      />
    </>
  );
};
