import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Step1Upload from './Step1Upload';
import Step2Profile from './Step2Profile';
import Step3MissingValues from './Step3MissingValues';
import Step4FlashFill from './Step4FlashFill';
import Step5Anomalies from './Step5Anomalies';
import Step6Export from './Step6Export';

const API_URL = 'http://localhost:8000';

export default function NormalModeApp() {
  const [currentStep, setCurrentStep] = useState(1);
  const [datasetInfo, setDatasetInfo] = useState(null);

  // Data for each step
  const [colTypes, setColTypes] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [profileData, setProfileData] = useState(null);

  const stepContainerRef = useRef(null);

  const handleUploadSuccess = (data) => {
    setDatasetInfo({
      filename: data.filename,
      rows: data.rows,
      columns: data.columns,
    });
    setPreviewData(data.preview);
    setColTypes(data.col_types);
  };

  const nextStep = (step) => {
    setCurrentStep(step);
    setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

  const stepVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  return (
    <div className="w-full space-y-8" ref={stepContainerRef}>
      <div className="flex items-center justify-between bg-slate-900 p-4 rounded-xl border border-slate-700">
        <h2 className="text-xl font-heading font-bold">Data Cleaning Pipeline</h2>
        <span className="text-sm font-medium text-slate-400 bg-slate-800 px-3 py-1 rounded-full">
          Step {currentStep} of 6
        </span>
      </div>

      <AnimatePresence>
        {/* STEP 1 */}
        {currentStep >= 1 && (
          <motion.div key="step1" variants={stepVariants} initial="hidden" animate="visible">
            <div className={currentStep === 1 ? 'block' : 'hidden'}>
              <Step1Upload
                apiUrl={API_URL}
                onSuccess={handleUploadSuccess}
                onContinue={() => nextStep(2)}
                colTypes={colTypes}
                setColTypes={setColTypes}
                previewData={previewData}
              />
            </div>
          </motion.div>
        )}

        {/* STEP 2 */}
        {currentStep >= 2 && (
          <motion.div key="step2" variants={stepVariants} initial="hidden" animate="visible">
            <div className={currentStep === 2 ? 'block' : 'hidden'}>
              <Step2Profile
                apiUrl={API_URL}
                onContinue={() => nextStep(3)}
                profileData={profileData}
                setProfileData={setProfileData}
                colTypes={colTypes}
                datasetInfo={datasetInfo}
                setDatasetInfo={setDatasetInfo}
              />
            </div>
          </motion.div>
        )}

        {/* STEP 3 */}
        {currentStep >= 3 && (
          <motion.div key="step3" variants={stepVariants} initial="hidden" animate="visible">
             <div className={currentStep === 3 ? 'block' : 'hidden'}>
              <Step3MissingValues
                apiUrl={API_URL}
                onContinue={() => nextStep(4)}
                colTypes={colTypes}
                profileData={profileData}
                setProfileData={setProfileData}
              />
            </div>
          </motion.div>
        )}

        {/* STEP 4 */}
        {currentStep >= 4 && (
          <motion.div key="step4" variants={stepVariants} initial="hidden" animate="visible">
            <div className={currentStep === 4 ? 'block' : 'hidden'}>
              <Step4FlashFill
                apiUrl={API_URL}
                onContinue={() => nextStep(5)}
                colTypes={colTypes}
                setColTypes={setColTypes}
              />
            </div>
          </motion.div>
        )}

        {/* STEP 5 */}
        {currentStep >= 5 && (
          <motion.div key="step5" variants={stepVariants} initial="hidden" animate="visible">
             <div className={currentStep === 5 ? 'block' : 'hidden'}>
              <Step5Anomalies
                apiUrl={API_URL}
                onContinue={() => nextStep(6)}
                colTypes={colTypes}
                setDatasetInfo={setDatasetInfo}
              />
            </div>
          </motion.div>
        )}

        {/* STEP 6 */}
        {currentStep >= 6 && (
          <motion.div key="step6" variants={stepVariants} initial="hidden" animate="visible">
            <div className={currentStep === 6 ? 'block' : 'hidden'}>
              <Step6Export
                apiUrl={API_URL}
                datasetInfo={datasetInfo}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
