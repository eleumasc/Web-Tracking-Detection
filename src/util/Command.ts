import yargs from "yargs";

export type Command<T> = (argv: yargs.Argv<T>) => yargs.Argv<T>;

export function defineCommand<T, R>(
  command: string | readonly string[],
  description: string,
  builder: yargs.BuilderCallback<T, R>,
  handler: (args: yargs.ArgumentsCamelCase<R>) => void | Promise<void>
): Command<T> {
  return (argv) => argv.command(command, description, builder, handler);
}

export function defineCommandGroup<T>(commands: Command<T>[]): Command<T> {
  return (argv) => commands.reduce((argv, command) => command(argv), argv);
}

export function runApp<T>(argv: yargs.Argv<T>, commands: Command<T>[]): void {
  commands.reduce((argv, command) => command(argv), argv).argv;
}
