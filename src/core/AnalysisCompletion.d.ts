import { AnalysisResult } from "./AnalysisResult";
import { Completion } from "../util/Completion";

export type AnalysisCompletion<T extends AnalysisResult> = Completion<T>;
