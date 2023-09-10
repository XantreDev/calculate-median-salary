import "@total-typescript/ts-reset";
import dayjs from "dayjs";
import { writeFile } from "fs/promises";
import { markdownTable } from "markdown-table";
import { group, mapValues, unique } from "radash";
import { z } from "zod";
import data from "./salaryData.json";

const median = (arr: number[]) => {
  const mid = Math.floor(arr.length / 2),
    nums = [...arr].sort((a, b) => a - b);
  return arr.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
};

const schema = z.array(
  z.object({
    title: z.string(),
    totalyearlycompensation: z
      .string()
      .transform((i) => +i)
      .pipe(z.number()),
    location: z.string(),
    timestamp: z.string(),
  })
);

const lowerIncludes = (a: string, b: string) =>
  a.toLowerCase().includes(b.toLowerCase());
const parsed = schema
  .parse(data)
  .filter(
    (i) => i.totalyearlycompensation > 5 && i.totalyearlycompensation < 1000
  )
  .filter((i) => lowerIncludes(i.title, "Software Engineer"))
  .filter((i) => !lowerIncludes(i.title, "Intern"))
  .filter((i) => !lowerIncludes(i.title, "Manager"));

const groupedByLocation = group(parsed, (i) => i.location);
const groupedByLocationNoUS = Object.fromEntries(
  Object.entries(groupedByLocation).filter(
    ([key, value]) =>
      !key.includes("United States") && key.split(",").length > 2 && value
  )
);

const groupedByYear = mapValues(
  groupedByLocationNoUS,
  (i) => i && group(i, (j) => dayjs(j.timestamp).year())
);

const meanByYear = mapValues(
  groupedByYear,
  (i) =>
    i &&
    mapValues(i, (j) => j && median(j.map((k) => k.totalyearlycompensation)))
);

const allYears = unique(
  Object.values(meanByYear)
    .map((locations) => locations && Object.keys(locations))
    .filter(Boolean)
    .flat()
    .map((i) => +i)
    .filter((i) => i >= 2018)
);

const result = markdownTable([
  ["Location", ...allYears.map((i) => i.toString())],
  ...Object.entries(meanByYear)
    .map(([location, years]) => [
      location,
      ...allYears.map((year) => years?.[year]?.toString() ?? null),
    ])
    .filter((i) => i.filter((j) => j === null).length < 2)
    .filter((i) => (groupedByLocationNoUS?.[i[0] ?? ""]?.length ?? 0) > 20)
    .sort(
      (a, b) =>
        median(
          b
            .slice(1)
            .map((i) => (i ? +i : null))
            .filter((a): a is number => !!a)
        ) -
        median(
          a
            .slice(1)
            .map((i) => (i ? +i : null))
            .filter((a): a is number => !!a)
        )
    ),
]);

writeFile(
  "README.md",
  `\
This is table of median yearly compensation for software engineers excluding USA, based on data from [levels.fyi](https://www.levels.fyi/).
Can be used as a rough estimate of wealthy income from relocation to another country.

${result}`,
  "utf-8"
);
