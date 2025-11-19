import significantlyDifferent from "../core/chen/significantlyDifferent";

async function main(args: { str1: string; str2: string }) {
  const { str1, str2 } = args;

  console.log(str1, str2, significantlyDifferent(str1, str2));

  process.exit(0);
}

main({
  str1: process.argv[2],
  str2: process.argv[3],
});
