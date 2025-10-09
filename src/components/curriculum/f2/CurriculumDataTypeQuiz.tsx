"use client";

import React from "react";
import DataTypeQuiz from "./DataTypeQuiz";
import { dataTypeQuizQuestions } from "@/content/f2/dataTypeQuizQuestions";

const CurriculumDataTypeQuiz: React.FC = () => {
  return <DataTypeQuiz questions={dataTypeQuizQuestions} />;
};

export default CurriculumDataTypeQuiz;
