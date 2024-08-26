import {XOR} from "@lucilor/utils";

export type Desc =
  | string
  | {
      content: string;
      sub?: Desc[];
      next?: Desc;
    };

interface ArgBase {
  name: string;
  value?: string;
  desc: Desc;
}

interface ArgString extends ArgBase {
  defaultValue: string;
}

interface ArgBoolean extends ArgBase {
  isBoolean?: boolean;
}

export type Arg = XOR<ArgString, ArgBoolean>;

export type ValuedArg = Required<Omit<ArgBase, "desc">>;

export interface Command {
  name: string;
  desc: Desc | Desc[];
  args: Arg[];
}

export interface ValuedCommand {
  name: string;
  args: ValuedArg[];
}
