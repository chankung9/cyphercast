import React, { useState } from 'react';


const PredictionForm = ({ stream }) => {
const [choice, setChoice] = useState('');


const submitPrediction = () => {
console.log(`Submitting prediction '${choice}' for stream ${stream.id}`);
// TODO: call client.ts joinStream / submitPrediction function
};


return (
<div>
<h4>Make a Prediction</h4>
<input type="text" value={choice} onChange={(e) => setChoice(e.target.value)} placeholder="Your prediction" />
<button onClick={submitPrediction}>Submit</button>
</div>
);
};


export default PredictionForm;