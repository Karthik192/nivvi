import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import nim from '../../../../../design/nim-states.json';

export type NimState = keyof typeof nim.states;

export function NimStill({ state = 'idle', size = 144 }: { state?: NimState; size?: number }) {
  const happy = ['celebrate', 'goal', 'saved'].includes(state);
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 220 240"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Ellipse cx="110" cy="217" rx="60" ry="10" fill="#243729" opacity={0.08} />
      <Path d="M102 75Q76 28 47 39q0 37 55 36Z" fill="#739E50" />
      <Path d="M106 72q10-51 49-45-1 39-49 45Z" fill="#98BA63" />
      <Path
        d="M109 80q-9-20-9-30"
        fill="none"
        stroke="#527C43"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <Path d="M73 186q-9 27 6 28l17-2-1-23M126 189l-2 23 17 2q15-2 5-28" fill="#AFCB78" />
      <Path d="M57 128q-28 8-23 27 10 11 29-1M161 128q28 8 23 27-10 11-29-1" fill="#AFCB78" />
      <Path
        d="M110 66c45 0 65 42 62 82-2 39-23 57-62 57s-60-18-62-57c-3-40 17-82 62-82Z"
        fill="#D6EAA4"
      />
      <Path d="M163 113q24 88-53 92-51-1-60-39 23 25 62 18 40-6 51-71Z" fill="#BCD585" />
      <Ellipse cx="83" cy="98" rx="14" ry="7" rotation={-35} origin="83,98" fill="#EEF6D8" />
      {happy ? (
        <Path
          d="m83 125 8-6 8 6m22 0 8-6 8 6"
          fill="none"
          stroke="#243729"
          strokeWidth="5"
          strokeLinecap="round"
        />
      ) : (
        <>
          <Ellipse cx="91" cy="124" rx="5" ry="7" fill="#243729" />
          <Ellipse cx="129" cy="124" rx="5" ry="7" fill="#243729" />
        </>
      )}
      <Ellipse cx="76" cy="140" rx="10" ry="5" fill="#DFAE91" opacity={0.65} />
      <Ellipse cx="144" cy="140" rx="10" ry="5" fill="#DFAE91" opacity={0.65} />
      {state === 'surprised' ? (
        <Ellipse cx="110" cy="145" rx="7" ry="9" fill="#243729" />
      ) : (
        <Path
          d="M101 141q9 10 18 0"
          fill="none"
          stroke="#243729"
          strokeWidth="4"
          strokeLinecap="round"
        />
      )}
      <Path d="m110 167 10 7-10 10-10-10Z" fill="#F6F5E9" />
      {state === 'saved' && (
        <>
          <Circle cx="177" cy="73" r="18" fill="#284F3B" />
          <Path
            d="m168 73 6 6 12-13"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </>
      )}
      {state === 'goal' && (
        <Path
          d="m30 60 4-10 4 10 10 4-10 4-4 10-4-10-10-4Zm148 14 3-8 3 8 8 3-8 3-3 8-3-8-8-3Z"
          fill="#D5976D"
        />
      )}
    </Svg>
  );
}
