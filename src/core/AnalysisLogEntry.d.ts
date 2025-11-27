import { AnalysisResult } from "./AnalysisResult";
import { Completion } from "../util/Completion";

export type AnalysisLogEntry<T extends AnalysisResult> = Completion<T>;
