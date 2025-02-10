import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Button,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
} from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

// Mock data for partners and datasets
const mockPartners = [
  { id: 1, name: 'Partner A', datasets: ['Dataset 1', 'Dataset 2', 'Dataset 3'] },
  { id: 2, name: 'Partner B', datasets: ['Dataset 4', 'Dataset 5'] },
  { id: 3, name: 'Partner C', datasets: ['Dataset 6', 'Dataset 7', 'Dataset 8'] },
];

// Mock training data for the chart
const mockTrainingData = Array.from({ length: 20 }, (_, i) => ({
  epoch: i + 1,
  loss: Math.random() * 0.5 + 0.5 - i * 0.02,
  accuracy: 0.5 + i * 0.02 + Math.random() * 0.1,
}));

const steps = ['Select Partners', 'Configure Training', 'Training Progress', 'Evaluate & Publish'];

const ModelTrainer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [activeStep, setActiveStep] = useState(0);
  const [selectedPartners, setSelectedPartners] = useState<number[]>([]);
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([]);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [trainingConfig, setTrainingConfig] = useState({
    modelType: 'transformer',
    learningRate: '0.001',
    batchSize: '32',
    epochs: '100',
  });
  const [isTraining, setIsTraining] = useState(false);

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handlePartnerToggle = (partnerId: number) => {
    setSelectedPartners((prev) =>
      prev.includes(partnerId)
        ? prev.filter((id) => id !== partnerId)
        : [...prev, partnerId]
    );
  };

  const handleDatasetToggle = (dataset: string) => {
    setSelectedDatasets((prev) =>
      prev.includes(dataset)
        ? prev.filter((d) => d !== dataset)
        : [...prev, dataset]
    );
  };

  const handleConfigChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setTrainingConfig((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleStartTraining = () => {
    setIsTraining(true);
    // Mock training start
    setTimeout(() => {
      handleNext();
    }, 2000);
  };

  const handlePublishModel = () => {
    // Mock publish action
    alert('Model published successfully!');
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Select Partners to Join Federation
            </Typography>
            <List>
              {mockPartners.map((partner) => (
                <ListItem
                  key={partner.id}
                  onClick={() => handlePartnerToggle(partner.id)}
                  sx={{ cursor: 'pointer' }}
                >
                  <ListItemIcon>
                    <Checkbox
                      checked={selectedPartners.includes(partner.id)}
                      edge="start"
                    />
                  </ListItemIcon>
                  <ListItemText primary={partner.name} />
                </ListItem>
              ))}
            </List>
            <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
              Select Datasets
            </Typography>
            <List>
              {mockPartners
                .filter((p) => selectedPartners.includes(p.id))
                .map((partner) =>
                  partner.datasets.map((dataset) => (
                    <ListItem
                      key={dataset}
                      onClick={() => handleDatasetToggle(dataset)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <ListItemIcon>
                        <Checkbox
                          checked={selectedDatasets.includes(dataset)}
                          edge="start"
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={dataset}
                        secondary={`From ${partner.name}`}
                      />
                    </ListItem>
                  ))
                )}
            </List>
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Training Configuration
            </Typography>
            <Paper sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Model Type</InputLabel>
                    <Select
                      value={trainingConfig.modelType}
                      onChange={(e) => handleConfigChange('modelType')(e as any)}
                      label="Model Type"
                    >
                      <MenuItem value="transformer">Transformer</MenuItem>
                      <MenuItem value="cnn">CNN</MenuItem>
                      <MenuItem value="mlp">MLP</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Learning Rate"
                    type="number"
                    value={trainingConfig.learningRate}
                    onChange={handleConfigChange('learningRate')}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Batch Size"
                    type="number"
                    value={trainingConfig.batchSize}
                    onChange={handleConfigChange('batchSize')}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Epochs"
                    type="number"
                    value={trainingConfig.epochs}
                    onChange={handleConfigChange('epochs')}
                  />
                </Grid>
              </Grid>
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleStartTraining}
                  disabled={isTraining}
                >
                  {isTraining ? 'Starting Training...' : 'Start Training'}
                </Button>
              </Box>
            </Paper>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Training Progress
            </Typography>
            <Paper sx={{ p: 3 }}>
              <Box sx={{ mb: 3 }}>
                <Typography variant="body1" color="text.secondary">
                  Training in progress... Current epoch: 20/100
                </Typography>
              </Box>
              <Box sx={{ width: '100%', height: 400 }}>
                <LineChart
                  width={800}
                  height={400}
                  data={mockTrainingData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="epoch" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="loss"
                    stroke="#8884d8"
                    name="Loss"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="accuracy"
                    stroke="#82ca9d"
                    name="Accuracy"
                  />
                </LineChart>
              </Box>
            </Paper>
          </Box>
        );

      case 3:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Model Evaluation
            </Typography>
            <Paper sx={{ p: 3 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom>
                    UMAP Visualization
                  </Typography>
                  <Box
                    sx={{
                      width: '100%',
                      height: 300,
                      bgcolor: 'grey.100',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    UMAP Placeholder
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom>
                    Performance Metrics
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemText
                        primary="Test Accuracy"
                        secondary="0.89"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Test Loss"
                        secondary="0.32"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="F1 Score"
                        secondary="0.87"
                      />
                    </ListItem>
                  </List>
                </Grid>
              </Grid>
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handlePublishModel}
                >
                  Publish Model
                </Button>
              </Box>
            </Paper>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box sx={{ width: '100%', p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Model Trainer
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Model ID: {id}
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Box sx={{ mt: 4 }}>
        {renderStepContent(activeStep)}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
            sx={{ mr: 1 }}
          >
            Back
          </Button>
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={
              (activeStep === 0 && selectedPartners.length === 0) ||
              (activeStep === 1 && !isTraining) ||
              activeStep === steps.length - 1
            }
          >
            {activeStep === steps.length - 1 ? 'Finish' : 'Next'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default ModelTrainer; 
