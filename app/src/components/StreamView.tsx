import React from 'react';
import PredictionForm from './PredictionForm';
import StakePanel from './StakePanel';


const StreamView = ({ stream }) => {
return (
<div>
<h3>Viewing: {stream.title}</h3>
<div style={{ border: '1px solid #444', padding: '8px', margin: '10px 0' }}>
<iframe
width="480"
height="270"
src="https://www.youtube.com/embed/dQw4w9WgXcQ"
title="Live Stream"
allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
></iframe>
</div>
<StakePanel stream={stream} />
<PredictionForm stream={stream} />
</div>
);
};


export default StreamView;